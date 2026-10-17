targetScope = 'resourceGroup'

@description('Disabled until the operator reviews daily execution cost and confirms database routing.')
param enableCleanup bool = false
param location string
param name string = 'rivock'
@description('Existing environment only; this template does not create or replace networking.')
param environmentName string = '${name}-env'
@allowed(['preview', 'production'])
param deploymentEnvironment string = 'preview'
@description('Exact CI-approved combined application image pinned by sha256 digest.')
param image string
@description('Restricted runtime role, with verify-full and the Linux CA bundle. Never use migration/admin credentials.')
@secure()
param databaseUrl string
@secure()
param rateHmacSecret string
param clerkIssuer string
param frontendOrigin string
param clerkAudience string = ''

resource environment 'Microsoft.App/managedEnvironments@2026-07-01' existing = {
  name: environmentName
}

resource cleanup 'Microsoft.App/jobs@2024-03-01' = if (enableCleanup) {
  name: '${name}-cleanup'
  location: location
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 60
      replicaRetryLimit: 0
      // Azure cron schedules are UTC. One bounded cleanup per day, never queue processing.
      scheduleTriggerConfig: { cronExpression: '0 6 * * *', parallelism: 1, replicaCompletionCount: 1 }
      secrets: [
        { name: 'database-url', value: databaseUrl }
        { name: 'rate-hmac', value: rateHmacSecret }
      ]
    }
    template: {
      containers: [{
        name: 'cleanup'
        image: image
        command: ['python', '-m', 'app.worker', '--cleanup-only']
        env: [
          { name: 'ENVIRONMENT', value: deploymentEnvironment }
          { name: 'DATABASE_URL', secretRef: 'database-url' }
          { name: 'RATE_HMAC_SECRET', secretRef: 'rate-hmac' }
          { name: 'CLERK_ISSUER', value: clerkIssuer }
          { name: 'CLERK_AUTHORIZED_PARTIES', value: frontendOrigin }
          { name: 'CLERK_AUDIENCE', value: clerkAudience }
          { name: 'CORS_ORIGINS', value: frontendOrigin }
          { name: 'MODERATION_MODE', value: 'off' }
          { name: 'AI_PAUSED', value: 'true' }
        ]
        resources: { cpu: json('0.25'), memory: '0.5Gi' }
      }]
    }
  }
}

output cleanupJobName string = enableCleanup ? cleanup!.name : ''
output cleanupScheduleEnabled bool = enableCleanup
