import urllib.request
import json

body = json.dumps({
    "budget": 1000000,
    "weights": {"heat": 0.25, "green": 0.25, "connectivity": 0.25, "pedestrian": 0.25}
}).encode()

req = urllib.request.Request(
    "http://localhost:8000/api/optimize",
    data=body,
    headers={"Content-Type": "application/json"},
)
resp = json.loads(urllib.request.urlopen(req).read())

print(f"Total cost: {resp['total_cost']}")
print(f"Recommendations: {len(resp['recommendations'])}")
print(f"Intervention counts: {resp['intervention_counts']}")
print(f"Total impact: {resp['total_impact']}")
