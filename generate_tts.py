import asyncio
import os
import edge_tts

output_dir = "d:/Games/AI Forecast/demo_video/assets"
os.makedirs(output_dir, exist_ok=True)

scripts = [
    {
        "name": "audio_scene1.mp3",
        "text": "Welcome to the SIH 26153 Predictive Cyber Defense System. Modern cyber defense requires moving beyond reactive intrusion alerts to proactive attack forecasting."
    },
    {
        "name": "audio_scene2.mp3",
        "text": "Our system continuously monitors network traffic, computing adaptive baseline anomalies and forecasting threat momentum to estimate time to escalation."
    },
    {
        "name": "audio_scene3.mp3",
        "text": "Explainable A I breaks down the exact telemetry shifts driving the risk score, giving security analysts complete transparency into why the forecast changed."
    },
    {
        "name": "audio_scene4.mp3",
        "text": "Module 3 runs counterfactual simulations in real time, evaluating candidate interventions to recommend the action with maximum projected risk reduction."
    },
    {
        "name": "audio_scene5.mp3",
        "text": "Fully integrated across all four modules and ready for deployment. Predictive Cyber Defense: stopping threats before they escalate."
    }
]

async def generate():
    voice = "en-US-AndrewNeural"
    for s in scripts:
        path = os.path.join(output_dir, s["name"])
        print(f"Generating {s['name']}...")
        communicate = edge_tts.Communicate(s["text"], voice)
        await communicate.save(path)
    print("All audio files generated successfully!")

if __name__ == "__main__":
    asyncio.run(generate())
