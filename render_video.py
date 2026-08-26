import os
import subprocess

env = os.environ.copy()
env["PATH"] = r"d:\Games\AI Forecast\bin;" + env.get("PATH", "")
env["PUPPETEER_CACHE_DIR"] = r"d:\Games\AI Forecast\bin\cache"
env["HYPERFRAMES_BROWSER_PATH"] = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

cmd = [
    "npx.cmd", "hyperframes", "render",
    "-o", "predictive_cyber_defense_demo.mp4"
]

print("Starting HyperFrames render script...")
res = subprocess.run(cmd, cwd=r"d:\Games\AI Forecast\demo_video", env=env)
print("Render finished with exit code:", res.returncode)
