import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPublicationBlockers, statusAfterEdit } from '../src/db/editorial-rules.ts';

test('no AI draft can publish directly without approval', () => {
  assert.ok(getPublicationBlockers({status:'in_review',currentVersion:1,approvedVersion:null,reviewedById:null},[]).length > 0);
});

test('an approved version may publish when all direct quotes are verified', () => {
  assert.deepEqual(getPublicationBlockers({status:'approved',currentVersion:2,approvedVersion:2,reviewedById:'editor-1'},['verified']),[]);
});

test('editing an approved draft requires another approval', () => {
  assert.notDeepEqual(getPublicationBlockers({status:'approved',currentVersion:3,approvedVersion:2,reviewedById:'editor-1'},[]),[]);
  assert.equal(statusAfterEdit(), 'in_review');
});

test('an unverified quote blocks publication', () => {
  const status={status:'approved',currentVersion:1,approvedVersion:1,reviewedById:'editor-1'};
  assert.equal(getPublicationBlockers(status,['unverified']).length,1);
  assert.equal(getPublicationBlockers(status,['rejected']).length,1);
});
