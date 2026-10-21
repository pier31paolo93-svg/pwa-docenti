// Contract stub: no provider, credentials, outbound requests or student data.
Deno.serve((_request: Request) => new Response(
  JSON.stringify({ code: "AI_DISABLED", message: "Integrazione AI non attivata in fase 1" }),
  { status: 501, headers: { "Content-Type": "application/json" } },
));
