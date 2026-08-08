import urllib.request
import json

url_runs = 'https://api.github.com/repos/ThoGoodBoy06/chat-Tho---Fi/actions/runs?per_page=1'
req_runs = urllib.request.Request(url_runs, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req_runs) as resp:
        data_runs = json.loads(resp.read().decode())
        run = data_runs['workflow_runs'][0]
        run_id = run['id']
        print(f"Latest Run ID: {run_id} | Status: {run['status']} | Conclusion: {run['conclusion']}")
        
        url_jobs = f'https://api.github.com/repos/ThoGoodBoy06/chat-Tho---Fi/actions/runs/{run_id}/jobs'
        req_jobs = urllib.request.Request(url_jobs, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_jobs) as resp_jobs:
            data_jobs = json.loads(resp_jobs.read().decode())
            job = data_jobs['jobs'][0]
            print(f"Job Status: {job['status']} | Conclusion: {job['conclusion']}")
            for step in job['steps']:
                print(f"  [{step['status']}] {step['name']} -> {step['conclusion']}")
except Exception as e:
    print("Error:", e)
