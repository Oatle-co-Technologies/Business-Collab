import test from 'node:test';import assert from 'node:assert/strict';
import {requireLocalTestDatabase} from './local-test-database.mjs';
test('integration fixtures only accept the explicitly named local database',()=>{
 for(const url of ['postgresql://localhost/business_collab','postgres://127.0.0.1/business_collab','postgresql://[::1]/business_collab'])assert.doesNotThrow(()=>requireLocalTestDatabase(url));
 for(const url of [undefined,'invalid','https://localhost/business_collab','postgresql://localhost/production','postgresql://cloud.example/business_collab'])assert.throws(()=>requireLocalTestDatabase(url));
});
