import test from 'node:test';import assert from 'node:assert/strict';
import {accountEmailMessage} from '../src/lib/account-email-rules.ts';
test('account emails preserve the one-time link and contain no user-controlled HTML',()=>{
 const link='https://app.example/api/auth/reset-password/token?callbackURL=%2Freset-password';
 const result=accountEmailMessage('https://app.example',link,'reset');assert.ok(result.text.includes(link));assert.match(result.subject,/reset/);assert.equal(result.html,undefined);
 assert.match(accountEmailMessage('https://app.example','https://app.example/api/auth/verify-email?token=abc','verify').subject,/verify/);
});
test('account email rejects insecure, credential-bearing, foreign-origin and wrong-purpose links',()=>{
 for(const link of ['https://evil.example/api/auth/reset-password/token','https://user:pass@app.example/api/auth/reset-password/token','http://app.example/api/auth/reset-password/token','https://app.example/identity','https://app.example/api/auth/verify-email?token=abc'])assert.throws(()=>accountEmailMessage('https://app.example',link,'reset'));
 assert.throws(()=>accountEmailMessage('http://app.example','http://app.example/api/auth/reset-password/token','reset'));
});
