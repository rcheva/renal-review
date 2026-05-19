from notebooklm_mcp.api_client import NotebookLMClient
from notebooklm_mcp.auth import load_cached_tokens
import json

tokens = load_cached_tokens()
client = NotebookLMClient(cookies=tokens.cookies, csrf_token=tokens.csrf_token, session_id=tokens.session_id)
notebooks = client.list_notebooks()
for nb in notebooks:
    params = [[2], nb.id, 'NOT artifact.status = "ARTIFACT_STATUS_SUGGESTED"']
    body = client._build_request_body(client.RPC_POLL_STUDIO, params)
    url = client._build_url(client.RPC_POLL_STUDIO, f"/notebook/{nb.id}")
    response = client._get_client().post(url, content=body)
    parsed = client._parse_response(response.text)
    result = client._extract_rpc_result(parsed, client.RPC_POLL_STUDIO)
    if not result: continue
    art_list = result[0] if isinstance(result[0], list) else result
    for art in art_list:
        if art[2] == 4:
            print(json.dumps(art, indent=2))
            exit(0)
