'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { detectCluster, getDistance } = require('./roleOntology')
const { getBridgeEvidence, evaluateBridge } = require('./bridgeRules')

test('groups project, program, and operations titles together', () => {
  const titles = [
    'Senior Project Manager',
    'Project Coordinator',
    'Program Coordinator',
    'Operations Manager',
    'Operations',
    'Revenue Operations Analyst',
    'Business Operations Specialist',
    'Chief of Staff',
    'PMO Analyst',
  ]

  for (const title of titles) {
    assert.equal(detectCluster(title)?.id, 'project_ops', title)
  }
})

test('keeps product management separate from project operations', () => {
  assert.equal(detectCluster('Senior Product Manager')?.id, 'product_mgmt')
  assert.equal(getDistance('project_ops', 'product_mgmt'), 2)
})

test('treats project coordination as adjacent to admin operations', () => {
  assert.equal(detectCluster('Administrative Coordinator')?.id, 'admin')
  assert.equal(getDistance('project_ops', 'admin'), 1)
})

test('requires an evidence-backed bridge into engineering roles', () => {
  const engineeringClusters = ['frontend', 'fullstack', 'backend', 'platform', 'data_ml', 'mobile']
  for (const cluster of engineeringClusters) {
    assert.equal(getDistance('project_ops', cluster), 3, cluster)
  }
})

test('does not show engineering without concrete technical skills', () => {
  const evidence = getBridgeEvidence(['project management', 'agile', 'jira'], 'project_ops', 'frontend')
  assert.equal(evaluateBridge(evidence, 3).show, false)
})

test('allows engineering when concrete technical skills support it', () => {
  const evidence = getBridgeEvidence(['react', 'typescript'], 'project_ops', 'frontend')
  assert.equal(evaluateBridge(evidence, 3).show, true)
})
