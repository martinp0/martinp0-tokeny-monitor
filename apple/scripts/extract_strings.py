#!/usr/bin/env python3
"""Lists the localizable string keys used in the app sources (SwiftUI literals,
String(localized:), LocalizedStringResource). Interpolations become %@ (only Strings are
interpolated in localized text). Used by gen_xcstrings.py; Xcode also extracts on build."""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIRS = ["SharedUI", "Components", "Widgets", "iOS", "macOS", "watchOS"]
CALLS = r'(?:Text|Label|Button|Section|Toggle|Picker|LabeledContent|Link|TextField|SecureField|String\(localized:|\.help|\.navigationTitle|\.configurationDisplayName|\.description|IntentDescription|confirmationDialog|AppIntentRecommendation\(intent: [A-Za-z]+\(\), description:|\.accessibilityLabel\(Text|shortTitle:)'
STR = r'"((?:[^"\\]|\\.)*)"'

def keys():
    out = set()
    for d in DIRS:
        for f in (ROOT / d).rglob("*.swift"):
            src = f.read_text()
            for m in re.finditer(CALLS + r'\s*\(?\s*' + STR, src):
                out.add(m.group(1))
            # static let title: LocalizedStringResource = "..."; case ...: "..." in localizedStringResource
            for m in re.finditer(r'LocalizedStringResource\s*=\s*' + STR, src):
                out.add(m.group(1))
            for m in re.finditer(r'case \.\w+: ' + STR, src):
                out.add(m.group(1))
            # Text("A") ternaries: `? Text("...") : Text("...")` are covered by Text(
    norm = set()
    for k in out:
        k = re.sub(r'\\\((?:[^()]|\([^()]*(?:\([^()]*\))*[^()]*\))*\)', '%@', k)
        k = k.replace('\\"', '"')
        norm.add(k)
    return sorted(norm)

if __name__ == "__main__":
    for k in keys():
        print(k)
