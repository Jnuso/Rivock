targetScope = 'subscription'
param budgetName string = 'rivock-monthly'
@description('Review subscription-wide usage before creating this budget. Alerts are not a spending cap.')
param startDate string
param endDate string
param contactEmail string

resource budget 'Microsoft.Consumption/budgets@2023-05-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: 10
    timeGrain: 'Monthly'
    timePeriod: { startDate: startDate, endDate: endDate }
    notifications: {
      actual50: { enabled: true, operator: 'GreaterThan', threshold: 50, contactEmails: [contactEmail], thresholdType: 'Actual' }
      actual80: { enabled: true, operator: 'GreaterThan', threshold: 80, contactEmails: [contactEmail], thresholdType: 'Actual' }
      actual100: { enabled: true, operator: 'GreaterThan', threshold: 100, contactEmails: [contactEmail], thresholdType: 'Actual' }
    }
  }
}
