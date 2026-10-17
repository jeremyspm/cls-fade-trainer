# Pre-records Mr Luke's and the RN's lines with Microsoft's NZ neural voices.
# Usage: python voices.py   (run node build.mjs first; skips files that already exist)
import asyncio, json, pathlib, edge_tts

HERE = pathlib.Path(__file__).parent / "audio"
VOICE = {
    "Mr Luke": dict(voice="en-NZ-MitchellNeural", rate="-14%", pitch="-12Hz"),
    "RN": dict(voice="en-NZ-MollyNeural", rate="-6%", pitch="+0Hz"),
}

async def main():
    lines = json.loads((HERE / "lines.json").read_text(encoding="utf-8"))
    for line in lines:
        out = HERE / f"{line['id']}.mp3"
        if out.exists() and out.stat().st_size > 0:
            continue
        await edge_tts.Communicate(line["text"], **VOICE[line["who"]]).save(str(out))
        print("made", out.name)

asyncio.run(main())
