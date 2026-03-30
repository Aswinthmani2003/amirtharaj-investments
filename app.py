import os
import requests
from flask import Flask, send_from_directory, request, Response

app = Flask(__name__, static_folder='.')

UPLOAD_TOOL_URL = os.environ.get(
    'UPLOAD_TOOL_URL',
    'https://client-master-app.onrender.com'
)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/admin')
@app.route('/admin.html')
def admin():
    return send_from_directory('.', 'admin.html')

@app.route('/analytics')
@app.route('/analytics.html')
def analytics():
    return send_from_directory('.', 'analytics.html')

@app.route('/upload', defaults={'path': ''}, methods=['GET','POST','PUT','DELETE','PATCH','OPTIONS'])
@app.route('/upload/<path:path>',            methods=['GET','POST','PUT','DELETE','PATCH','OPTIONS'])
def proxy_upload(path):
    target = f"{UPLOAD_TOOL_URL}/{path}"
    if request.query_string:
        target += '?' + request.query_string.decode('utf-8')

    fwd_headers = {
        k: v for k, v in request.headers
        if k.lower() not in ('host', 'content-length')
    }

    try:
        resp = requests.request(
            method=request.method,
            url=target,
            headers=fwd_headers,
            data=request.get_data(),
            cookies=request.cookies,
            allow_redirects=False,
            timeout=30,
            stream=True,
        )

        excluded = {
            'content-encoding','content-length',
            'transfer-encoding','connection',
            'keep-alive'
        }
        headers = [
            (k, v.replace(UPLOAD_TOOL_URL, '/upload'))
            if k.lower() == 'location'
            else (k, v)
            for k, v in resp.raw.headers.items()
            if k.lower() not in excluded
        ]

        return Response(resp.content, resp.status_code, headers)

    except requests.exceptions.ConnectionError:
        return Response(
            '<h2>Starting up...</h2><p>Please wait 30 seconds and refresh.</p>'
            '<script>setTimeout(()=>location.reload(),15000)</script>',
            503, {'Content-Type': 'text/html'}
        )

@app.route('/<path:path>')
def static_files(path):
    if os.path.isfile(os.path.join('.', path)):
        return send_from_directory('.', path)
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
