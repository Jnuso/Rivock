targetScope = 'resourceGroup'

@description('Choose a supported region after checking student eligibility and total cost.')
param location string
param name string = 'rivock'
@description('Combined website/API GHCR image pinned by sha256 digest. Build/publish after CI passes.')
param image string
@description('Existing reviewed PostgreSQL runtime connection URL, including sslmode=verify-full.')
@secure()
param databaseUrl string
@secure()
param migrationDatabaseUrl string
@secure()
param rateHmacSecret string
@secure()
param aiApiKey string = ''
param frontendOrigin string
@description('Clerk production Frontend API HTTPS origin, without a trailing slash.')
param clerkIssuer string
param clerkAudience string = ''
@allowed(['pending', 'google'])
param moderationMode string = 'pending'
param aiModel string = ''
@allowed(['metered', 'free'])
param aiBillingMode string = 'metered'
param aiInputPrice string = '0'
param aiOutputPrice string = '0'
@description('Enable only after the explicit migration job succeeds. No automatic schema upgrades.')
param enableApi bool = false
@description('Enable after migration and cost review. Every five minutes; no parallel replicas.')
param enableWorker bool = false

var sharedEnv = [
  { name: 'ENVIRONMENT', value: 'production' }
  { name: 'DATABASE_URL', secretRef: 'database-url' }
  { name: 'RATE_HMAC_SECRET', secretRef: 'rate-hmac' }
  { name: 'AI_API_KEY', secretRef: 'ai-key' }
  { name: 'CLERK_ISSUER', value: clerkIssuer }
  { name: 'CLERK_AUTHORIZED_PARTIES', value: frontendOrigin }
  { name: 'CLERK_AUDIENCE', value: clerkAudience }
  { name: 'CORS_ORIGINS', value: frontendOrigin }
  { name: 'MODERATION_MODE', value: moderationMode }
  { name: 'AI_MODEL', value: aiModel }
  { name: 'AI_BILLING_MODE', value: aiBillingMode }
  { name: 'AI_INPUT_USD_PER_MILLION', value: aiInputPrice }
  { name: 'AI_OUTPUT_USD_PER_MILLION', value: aiOutputPrice }
  { name: 'AI_MONTHLY_BUDGET_USD', value: '2' }
  { name: 'AI_DAILY_CALL_CAP', value: '100' }
]
var secrets = [
  { name: 'database-url', value: databaseUrl }
  { name: 'rate-hmac', value: rateHmacSecret }
  { name: 'ai-key', value: aiApiKey }
]

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${name}-env'
  location: location
  properties: {
    appLogsConfiguration: { destination: 'none' }
  }
}

resource migrate 'Microsoft.App/jobs@2024-03-01' = {
  name: '${name}-migrate'
  location: location
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 120
      replicaRetryLimit: 0
      manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 }
      secrets: [{ name: 'migration-database', value: migrationDatabaseUrl }]
    }
    template: {
      containers: [{
        name: 'migrate'
        image: image
        command: ['alembic', 'upgrade', 'head']
        env: [
          { name: 'DATABASE_URL', secretRef: 'migration-database' }
          // Migration process has no web listener or auth bypass. It only needs DB settings.
          { name: 'ENVIRONMENT', value: 'migration' }
        ]
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
      }]
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = if (enableApi) {
  name: '${name}-api'
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: secrets
      ingress: { external: true, targetPort: 8000, transport: 'http', allowInsecure: false }
    }
    template: {
      scale: { minReplicas: 0, maxReplicas: 1 }
      containers: [{
        name: 'api'
        image: image
        env: sharedEnv
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
        probes: [
          { type: 'Liveness', httpGet: { path: '/health/live', port: 8000 }, initialDelaySeconds: 5, periodSeconds: 15 }
          { type: 'Readiness', httpGet: { path: '/health/ready', port: 8000 }, initialDelaySeconds: 5, periodSeconds: 10 }
        ]
      }]
    }
  }
}

resource worker 'Microsoft.App/jobs@2024-03-01' = if (enableWorker) {
  name: '${name}-worker'
  location: location
  properties: {
    environmentId: environment.id
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 60
      replicaRetryLimit: 0
      scheduleTriggerConfig: { cronExpression: '*/5 * * * *', parallelism: 1, replicaCompletionCount: 1 }
      secrets: secrets
    }
    template: {
      containers: [{
        name: 'worker'
        image: image
        command: ['python', '-m', 'app.worker', '--once']
        env: sharedEnv
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
      }]
    }
  }
}

output frontendHostname string = enableApi ? api!.properties.configuration.ingress.fqdn : ''
output migrationJobName string = migrate.name
output apiHostname string = enableApi ? api!.properties.configuration.ingress.fqdn : ''
