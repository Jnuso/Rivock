targetScope = 'resourceGroup'

param serverName string
@description('Exact, validated global IPv4 addresses reported by the app. Never supply ranges or 0.0.0.0.')
@minLength(1)
@maxLength(250)
param outboundIps string[]

resource database 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = {
  name: serverName
}

@batchSize(8)
resource rules 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = [for address in outboundIps: {
  parent: database
  name: 'RivockAppEgress_${uniqueString(address)}'
  properties: {
    startIpAddress: address
    endIpAddress: address
  }
}]

output ruleCount int = length(outboundIps)
