# Eloquent

AI-powered text-to-speech for VS Code. Select text and hear it read aloud.

![Eloquent Icon](media/icon.png)

## Features

- **Select & Listen** - Highlight any text and have it read aloud instantly
- **Download Audio** - Save selected text as an MP3 file
- **Multiple Providers** - OpenAI, ElevenLabs, Azure, or free local system TTS
- **Playback Controls** — Play, pause, stop, seek, and adjust playback speed
- **Quick Settings** — Change provider, voice, and speed from the command palette
- **Configurable** — Customize voice, speed, and more

## Usage

1. Select text in the editor
2. Trigger "Read Aloud" via:
   - **Right-click** → "Read Aloud"
   - **Command Palette** (`Ctrl+Shift+P`) → "Eloquent: Read Aloud"
   - **Keyboard shortcut** `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`)

3. Use the player panel to control playback

## Commands

Access these via `Ctrl+Shift+P` (Command Palette):

| Command                      | Description                          |
| ---------------------------- | ------------------------------------ |
| **Eloquent: Read Aloud**     | Read selected text aloud             |
| **Eloquent: Stop Reading**   | Stop current playback                |
| **Eloquent: Select Provider**| Quick switch between TTS providers   |
| **Eloquent: Select Voice**   | Choose a voice for current provider  |
| **Eloquent: Set Speed**      | Adjust playback speed                |
| **Eloquent: Open Settings**  | Open Eloquent settings               |

## Providers

### OpenAI (Default)

High-quality AI voices. Requires an [OpenAI API key](https://platform.openai.com/api-keys).

**Voices:** alloy, echo, fable, onyx, nova, shimmer

### ElevenLabs

Ultra-realistic AI voices. Requires an [ElevenLabs API key](https://elevenlabs.io/).

**Voices:** rachel, drew, clyde, paul, sarah, emily, charlie, josh, arnold, charlotte, alice, matilda, james, adam, and more

### Azure Speech

Microsoft neural voices. Requires an [Azure Speech API key](https://azure.microsoft.com/en-us/products/ai-services/text-to-speech).

**Voices:** jenny, guy, aria, davis, sonia, ryan, libby, maisie, michelle, nancy, roger, sara, and more

### Local TTS

Free, built-in system voices. No API key required.

- **Windows:** SAPI (System.Speech)
- **macOS:** `say` command
- **Linux:** espeak

## Settings

| Setting                    | Description                                            | Default   |
| -------------------------- | ------------------------------------------------------ | --------- |
| `eloquent.provider`        | TTS provider (`openai`, `elevenlabs`, `azure`, `local`)| `openai`  |
| `eloquent.voice`           | Voice name for the selected provider                   | `nova`    |
| `eloquent.speed`           | Playback speed (0.25 - 4.0)                            | `1.0`     |
| `eloquent.maxCharacters`   | Max characters per request                             | `4096`    |
| `eloquent.openaiApiKey`    | Your OpenAI API key                                    | —         |
| `eloquent.elevenlabsApiKey`| Your ElevenLabs API key                                | —         |
| `eloquent.azureApiKey`     | Your Azure Speech API key                              | —         |
| `eloquent.azureRegion`     | Azure region (e.g., eastus, westeurope)                | `eastus`  |

## Requirements

- VS Code 1.85.0 or higher
- For cloud providers: Valid API key with available credits
- For Local TTS: No additional requirements

## Installation

### From Marketplace

Search for "Eloquent" in the VS Code Extensions view.

### From Source

```bash
git clone https://github.com/jshwek/eloquent.git
cd eloquent
npm install
npm run compile
```

Then press F5 in VS Code to run the extension.

## License

MIT
