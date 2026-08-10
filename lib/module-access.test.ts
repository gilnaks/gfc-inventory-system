import assert from 'node:assert/strict'
import {
  bypassesAccessLocks,
  filterLockedSubTabs,
  getLockReason,
  isModuleFullyLocked,
  isModuleLocked,
  isSubTabLocked,
  LOCKABLE_MODULES,
  parseModuleAccessLockRows,
  visibleSubTabKeys,
  type ModuleAccessLock,
} from './module-access'

function lock(
  moduleKey: string,
  subTabKey: string | null = null,
  reason: string | null = null
): ModuleAccessLock {
  return { moduleKey, subTabKey, reason, lockedBy: null }
}

function runTests() {
  const accountingSubTabs =
    LOCKABLE_MODULES.find((m) => m.key === 'accounting')?.subTabs.map((t) => t.key) || []
  assert.ok(accountingSubTabs.includes('journal'))

  // A locked module hides itself and every one of its sub-tabs.
  const moduleLocked = [lock('accounting')]
  assert.equal(isModuleLocked(moduleLocked, 'accounting'), true)
  assert.equal(isSubTabLocked(moduleLocked, 'accounting', 'journal'), true)
  assert.equal(isSubTabLocked(moduleLocked, 'accounting', 'reconciliation'), true)
  assert.equal(isModuleLocked(moduleLocked, 'purchasing'), false)
  assert.deepEqual(visibleSubTabKeys(accountingSubTabs, moduleLocked, 'accounting', false), [])

  // A sub-tab lock leaves the module and its other sub-tabs visible.
  const subTabLocked = [lock('accounting', 'journal')]
  assert.equal(isModuleLocked(subTabLocked, 'accounting'), false)
  assert.equal(isSubTabLocked(subTabLocked, 'accounting', 'journal'), true)
  assert.equal(isSubTabLocked(subTabLocked, 'accounting', 'reconciliation'), false)
  assert.deepEqual(
    visibleSubTabKeys(accountingSubTabs, subTabLocked, 'accounting', false),
    accountingSubTabs.filter((key) => key !== 'journal')
  )

  // Developers bypass everything.
  assert.equal(bypassesAccessLocks('developer'), true)
  assert.equal(bypassesAccessLocks('admin'), false)
  assert.equal(bypassesAccessLocks('guest'), false)
  assert.equal(bypassesAccessLocks(null), false)
  assert.deepEqual(
    visibleSubTabKeys(accountingSubTabs, moduleLocked, 'accounting', true),
    accountingSubTabs
  )
  assert.deepEqual(
    filterLockedSubTabs(
      [{ id: 'journal' }, { id: 'reconciliation' }],
      subTabLocked,
      'accounting',
      false
    ),
    [{ id: 'reconciliation' }]
  )

  // Locking every sub-tab is equivalent to locking the module for display purposes.
  const everySubTabLocked = accountingSubTabs.map((key) => lock('accounting', key))
  assert.equal(isModuleLocked(everySubTabLocked, 'accounting'), false)
  assert.equal(isModuleFullyLocked(everySubTabLocked, 'accounting'), true)
  assert.equal(isModuleFullyLocked(subTabLocked, 'accounting'), false)
  assert.equal(isModuleFullyLocked([], 'orders'), false)

  // Reasons fall back from the sub-tab to the parent module.
  const withReasons = [lock('accounting', null, 'Chart rewrite'), lock('accounting', 'journal', 'Posting fix')]
  assert.equal(getLockReason(withReasons, 'accounting', 'journal'), 'Posting fix')
  assert.equal(getLockReason(withReasons, 'accounting', 'reconciliation'), 'Chart rewrite')
  assert.equal(getLockReason([], 'accounting'), null)

  // Unknown module and sub-tab keys are ignored when rows are parsed.
  const parsed = parseModuleAccessLockRows([
    { module_key: 'accounting', sub_tab_key: null, reason: '  ', locked_by: 'dev' },
    { module_key: 'accounting', sub_tab_key: 'journal' },
    { module_key: 'not_a_module', sub_tab_key: null },
    { module_key: 'accounting', sub_tab_key: 'not_a_sub_tab' },
    { module_key: '  ', sub_tab_key: null },
  ])
  assert.deepEqual(parsed, [
    { moduleKey: 'accounting', subTabKey: null, reason: null, lockedBy: 'dev' },
    { moduleKey: 'accounting', subTabKey: 'journal', reason: null, lockedBy: null },
  ])
  assert.deepEqual(parseModuleAccessLockRows(null), [])

  // Unknown keys never lock anything.
  assert.equal(isModuleLocked(moduleLocked, 'not_a_module'), false)
  assert.equal(isSubTabLocked(subTabLocked, 'accounting', 'not_a_sub_tab'), false)

  console.log('module-access.test.ts: all passed')
}

runTests()
