import {clearSession,jsonError,requestIsSameOrigin} from "@/lib/auth";
export const runtime="edge";
export async function POST(request:Request){if(!requestIsSameOrigin(request))return jsonError("Request rejected.",403);await clearSession();return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}})}