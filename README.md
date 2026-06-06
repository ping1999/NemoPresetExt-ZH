# NemoPresetExt Chinese Translation

Chinese translation patch for the NemoPresetExt SillyTavern extension.

This extension intentionally does not modify NemoPresetExt source files. It loads after NemoPresetExt, watches NemoPresetExt-owned UI roots, and translates matching text nodes and common attributes such as `title`, `placeholder`, and `aria-label`.

## Install

Place this folder next to `NemoPresetExt` in SillyTavern's third-party extensions directory, then enable it from SillyTavern's extension manager.

Expected layout:

```text
SillyTavern/public/scripts/extensions/third-party/
  NemoPresetExt/
  NemoPresetExt-ZH/
```

## Notes

- Runs only when the current UI language is Chinese. For testing, set `window.NEMO_PRESET_EXT_ZH_FORCE = true` before the extension starts.
- Avoids translating chat messages, prompt names, preset names, and user-authored content.
- This is a runtime patch. If NemoPresetExt changes class names or English strings, update `i18n/zh-cn.json` or the selectors in `index.js`.
