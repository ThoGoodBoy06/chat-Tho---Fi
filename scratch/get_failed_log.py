import urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        print("Redirect URL:", newurl)
        return None

url = 'https://api.github.com/repos/ThoGoodBoy06/chat-Tho---Fi/actions/jobs/92807774273/logs'
opener = urllib.request.build_opener(NoRedirect)
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    resp = opener.open(req)
except Exception as e:
    if hasattr(e, 'headers') and 'Location' in e.headers:
        loc = e.headers['Location']
        print("Log download URL:", loc[:100] + "...")
        with urllib.request.urlopen(loc) as r:
            text = r.read().decode('utf-8', errors='ignore')
            lines = text.split('\n')
            for l in lines:
                if 'error:' in l.lower() or 'failed' in l.lower() or 'exception' in l.lower():
                    print(l)
    else:
        print("Error:", e)
