import {test} from "node:test";
import assert from "node:assert/strict";
import {collaborationSchema, participantTransition} from "../src/lib/collaboration-rules.ts";

test("requests validate brief and normalise required services",()=>{
 const valid={organizerId:"business-a",title:"Wedding service team",description:"We need other businesses to help deliver a wedding project.",servicesNeeded:"Baking, Makeup, Baking",location:"Pretoria",discoveryArea:"Pretoria and Johannesburg",visibility:"OPEN"};
 assert.deepEqual(collaborationSchema.parse(valid).servicesNeeded,["Baking","Makeup"]);
 for(const change of [{servicesNeeded:", ,"},{description:"short"},{organizerId:""},{visibility:"PUBLIC"}])assert.equal(collaborationSchema.safeParse({...valid,...change}).success,false);
});
test("invitation acceptance expresses interest, never selects a team member",()=>{
 assert.equal(participantTransition("participant","PENDING","accept",true),"INTERESTED");
 assert.equal(participantTransition("organizer","INTERESTED","select",true),"SELECTED");
 assert.throws(()=>participantTransition("organizer","PENDING","select",true));
 assert.throws(()=>participantTransition("participant","INTERESTED","select",true));
 assert.throws(()=>participantTransition("organizer","PENDING","accept",true));
});
test("closed requests block new acceptance and selection but allow declining or withdrawing",()=>{
 assert.throws(()=>participantTransition("participant","PENDING","accept",false));
 assert.throws(()=>participantTransition("organizer","INTERESTED","select",false));
 assert.equal(participantTransition("participant","PENDING","decline",false),"DECLINED");
 assert.equal(participantTransition("participant","SELECTED","withdraw",false),"WITHDRAWN");
 assert.equal(participantTransition("organizer","SELECTED","unselect",true),"INTERESTED");
 assert.throws(()=>participantTransition("participant","WITHDRAWN","accept",true));
});
