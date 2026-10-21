import "server-only";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db";
import { founderId } from "@/lib/safety-access";
import { deliverSafetyEmails, safetyEmailMessage } from "@/lib/safety-email-queue";
export function safetyEmailConfigured(){return process.env.SAFETY_EMAIL_ENABLED==="true"&&!!process.env.SMTP_USER&&!!process.env.SMTP_PASSWORD&&!!process.env.SMTP_FROM;}
export async function sendQueuedSafetyEmails(){
 if(!safetyEmailConfigured())return {enabled:false,sent:0,failed:0};
 const from=process.env.SMTP_FROM!;if(/[\r\n]/.test(from))throw new Error("Invalid sender configuration.");
 const message=safetyEmailMessage(process.env.BETTER_AUTH_URL!);
 const transport=nodemailer.createTransport({host:"smtp.purelymail.com",port:465,secure:true,auth:{user:process.env.SMTP_USER!,pass:process.env.SMTP_PASSWORD!},connectionTimeout:5000,greetingTimeout:5000,socketTimeout:5000,tls:{minVersion:"TLSv1.2",rejectUnauthorized:true},disableFileAccess:true,disableUrlAccess:true});
 try{return {enabled:true,...await deliverSafetyEmails(getDb(),founderId(),async(to,id)=>{const result=await transport.sendMail({from,to,...message,messageId:`<safety-${id}@${new URL(process.env.BETTER_AUTH_URL!).hostname}>`});if(!result.accepted?.length)throw new Error("Email was not accepted.");})};}finally{transport.close();}
}
