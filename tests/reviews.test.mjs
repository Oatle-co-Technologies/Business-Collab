import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewSchema, reviewPairAllowed } from '../src/lib/review-rules.ts';
test('review requires a bounded integer rating and meaningful text', () => {
 const valid={authorId:'a',targetId:'b',rating:'5',body:'Excellent work on our project.'};
 assert.equal(reviewSchema.parse(valid).rating,5);
 for(const rating of ['0','6','2.5','NaN',''])assert.equal(reviewSchema.safeParse({...valid,rating}).success,false);
 assert.equal(reviewSchema.safeParse({...valid,body:'short'}).success,false);
 assert.equal(reviewSchema.safeParse({...valid,body:'x'.repeat(2001)}).success,false);
});
test('review pair must belong to the reviewer and a different business owner',()=>{
 const a={id:'a',ownerId:'alice'},b={id:'b',ownerId:'bob'};
 assert.equal(reviewPairAllowed(a,b,'alice'),true);
 assert.equal(reviewPairAllowed(a,b,'bob'),false);
 assert.equal(reviewPairAllowed(a,a,'alice'),false);
 assert.equal(reviewPairAllowed(a,{id:'other',ownerId:'alice'},'alice'),false);
 assert.equal(reviewPairAllowed(a,{id:'legacy',ownerId:null},'alice'),false);
});
