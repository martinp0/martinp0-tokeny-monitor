#!/usr/bin/env python3
"""Regenerates SharedUI/Localizable.xcstrings and SharedUI/AppShortcuts.xcstrings (English source,
Czech translations). Fails if a key used in the sources has no Czech translation.
Run after changing UI text:  python3 apple/scripts/gen_xcstrings.py"""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from extract_strings import keys, ROOT

NBSP = "\u00a0"
CS = {
    "%@ of %@": "%1$@ z %2$@",
    "%@ of your AI budget used": "Vyčerpáno %@ rozpočtu na AI",
    "AI %@ this month": "AI %@ tento měsíc",
    "AI budget exceeded": "Rozpočet na AI je překročený",
    "AI spend": "Útrata za AI",
    "Account": "Účet",
    "All good, %@ of your budget used.": "V pořádku, vyčerpáno %@ rozpočtu.",
    "Budget": "Rozpočet",
    "Budget %@": "Rozpočet %@",
    "Budget %@ used.": "Rozpočet vyčerpán na %@.",
    "Budget alerts": "Upozornění na rozpočet",
    "Careful, %@ of your budget used.": "Pozor, vyčerpáno %@ rozpočtu.",
    "Check your inbox and confirm your e-mail, then sign in.": "Potvrď e-mail odkazem ve schránce a pak se přihlas.",
    "Choose a longer password (at least 8 characters).": "Zvol delší heslo (aspoň 8 znaků).",
    "Confirm your e-mail first. We sent you a link.": "Nejdřív potvrď e-mail. Poslali jsme ti odkaz.",
    "Connect an OpenAI, Anthropic or OpenRouter key on the web to see your spend.": "Připoj na webu klíč k OpenAI, Anthropicu nebo OpenRouteru a uvidíš svou útratu.",
    "Connect your provider keys on the web. The app only reads your totals.": "Klíče k poskytovatelům připojíš na webu. Appka čte jen součty.",
    "Couldn't load your spend. Try again in a moment.": "Útratu se nepodařilo načíst. Zkus to za chvíli.",
    "Create account": "Vytvořit účet",
    "Czech koruna (Kč)": "Česká koruna (Kč)",
    "Daily": "Po dnech",
    "Daily spend this month": "Denní útrata tento měsíc",
    "Dashboard": "Přehled",
    "Day": "Den",
    "Delete account and data": "Smazat účet a data",
    "Delete account…": "Smazat účet…",
    "Delete your Tokeny account?": "Smazat účet v Tokenech?",
    "Display": "Zobrazení",
    "Done": "Hotovo",
    "E-mail": "E-mail",
    "Forecast": "Odhad",
    "Forecast for the month %@.": "Odhad na celý měsíc %@.",
    "Forgot password?": "Zapomenuté heslo?",
    "Free": "Free",
    "Full history, month-end forecast, budget alerts and unlimited providers.": "Celá historie, odhad na konec měsíce, upozornění na rozpočet a neomezeně poskytovatelů.",
    "How much did I spend on AI today?": "Kolik jsem dnes utratil za AI?",
    "I have an account": "Už mám účet",
    "Is my AI budget OK?": "Je rozpočet na AI v pořádku?",
    "Last month": "Minulý měsíc",
    "Main currency": "Hlavní měna",
    "Manage account on the web": "Spravovat účet na webu",
    "Upgrade on the web": "Přejít na Pro na webu",
    "Month %@": "Měsíc %@",
    "No data yet": "Zatím žádná data",
    "Not signed in. Sign in from the menu bar.": "Nejsi přihlášený. Přihlas se v menu baru.",
    "Open Tokeny and sign in first.": "Nejdřív otevři Tokeny a přihlas se.",
    "Open Tokeny on iPhone": "Otevři Tokeny na iPhonu",
    "Open at login": "Spustit po přihlášení",
    "Open the web dashboard": "Otevřít přehled na webu",
    "Open tokeny.martinpohl.cz": "Otevřít tokeny.martinpohl.cz",
    "Password": "Heslo",
    "Plan": "Tarif",
    "Privacy": "Soukromí",
    "Providers": "Poskytovatelé",
    "Quit": "Ukončit",
    "Quit (⌘Q)": "Ukončit (⌘Q)",
    "Refresh": "Obnovit",
    "Refresh (⌘R)": "Obnovit (⌘R)",
    "Returns true while this month's AI spend is below your budget alert threshold.": "Vrátí Ano, dokud je měsíční útrata za AI pod prahem upozornění. Hodí se do automatizací.",
    "Settings": "Nastavení",
    "Settings (⌘,)": "Nastavení (⌘,)",
    "Sign in": "Přihlásit se",
    "Sign in to Tokeny": "Přihlas se do Tokenů",
    "Sign in to Tokeny on your iPhone. Your spend shows up here.": "Přihlas se do Tokenů na iPhonu. Útrata se pak ukáže tady.",
    "Sign in with Apple failed. Try again.": "Přihlášení přes Apple se nepovedlo. Zkus to znovu.",
    "Sign out": "Odhlásit se",
    "Sign-in failed. Try again.": "Přihlášení se nepovedlo. Zkus to znovu.",
    "Signed in as": "Přihlášen jako",
    "Spend": "Útrata",
    "Spend today": "Útrata dnes",
    "Tells you today's and this month's AI spend and how much of your budget is used.": "Řekne dnešní a měsíční útratu za AI a kolik je vyčerpáno z rozpočtu.",
    "The Tokeny server is being updated. Try again in a few minutes.": "Server Tokenů se právě aktualizuje. Zkus to za pár minut.",
    "The server had a problem. Try again later.": "Na serveru nastala chyba. Zkus to později.",
    "This e-mail already has an account. Sign in instead.": "S tímhle e-mailem už účet existuje. Přihlas se.",
    "This month": "Tento měsíc",
    "This month's AI spend and your budget.": "Útrata za AI tento měsíc a rozpočet.",
    "This needs Tokeny Pro.": "Tohle je součást Tokeny Pro.",
    "This permanently deletes your account, provider keys and usage history. If you have Pro, cancel the subscription on the web first.": "Natrvalo smaže účet, klíče k poskytovatelům i historii. Pokud máš Pro, nejdřív zruš předplatné na webu.",
    "Today": "Dnes",
    "Today %@": "Dnes %@",
    "Today %@, this month %@.": "Dnes %1$@, tento měsíc %2$@.",
    "Tokens": "Tokeny",
    "Tokeny": "Tokeny",
    "Tokeny Pro": "Tokeny Pro",
    "Tokeny notifies you once when you reach your alert threshold and once at 100 % of your monthly budget. Set the budget on the web.": f"Tokeny tě upozorní jednou při dosažení prahu a jednou při 100{NBSP}% měsíčního rozpočtu. Rozpočet nastavíš na webu.",
    "Top models": "Nejdražší modely",
    "Try again": "Zkusit znovu",
    "US dollar ($)": "Americký dolar ($)",
    "Unexpected response from the server. Update the app.": "Server odpověděl nečekaně. Aktualizuj appku.",
    "Updated %@": "Aktualizováno %@",
    "Version": "Verze",
    "We sent you a link to set a new password.": "Poslali jsme ti odkaz na nastavení nového hesla.",
    "Wrong e-mail or password.": "Špatný e-mail nebo heslo.",
    "You haven't set a monthly budget. Set one on the web.": "Nemáš nastavený měsíční rozpočet. Nastavíš ho na webu.",
    "You're offline.": "Jsi offline.",
    "You're offline. Showing the last data.": "Jsi offline. Ukazuju poslední data.",
    "You've been signed out. Please sign in again.": "Byl jsi odhlášen. Přihlas se prosím znovu.",
    "You've spent %@ of %@ this month.": "Tento měsíc jsi utratil %1$@ z %2$@.",
    "Your AI spend across OpenAI, Anthropic and OpenRouter, in Kč and dollars.": "Útrata za AI napříč OpenAI, Anthropicem a OpenRouterem, v korunách i dolarech.",
    "or with e-mail": "nebo e-mailem",
    "Pro": "Pro",
}

SHORTCUT_PHRASES = {
    "How much did I spend on AI today in ${applicationName}": "Kolik jsem dnes utratil za AI v ${applicationName}",
    "${applicationName} spend today": "Útrata v ${applicationName} dnes",
    "Check ${applicationName}": "Zkontroluj ${applicationName}",
    "Is my AI budget OK in ${applicationName}": "Je rozpočet na AI v ${applicationName} v pořádku",
    "${applicationName} budget": "Rozpočet v ${applicationName}",
}

def unit(value):
    return {"stringUnit": {"state": "translated", "value": value}}

def positional(s):
    n = 0
    def rep(_):
        nonlocal n
        n += 1
        return f"%{n}$@"
    import re
    return re.sub(r"%@", rep, s)

def catalog(entries, extract_state=None):
    strings = {}
    for key in sorted(entries):
        e = {"localizations": {"cs": unit(entries[key])}}
        if key.count("%@") > 1:
            e["localizations"]["en"] = unit(positional(key))
        if extract_state:
            e["extractionState"] = extract_state
        strings[key] = e
    return {"sourceLanguage": "en", "strings": strings, "version": "1.0"}

def main():
    used = keys() + ["Day", "Free", "Pro"]
    missing = sorted(set(used) - set(CS))
    if missing:
        sys.exit("Missing Czech translations:\n  " + "\n  ".join(missing))
    entries = {k: CS[k] for k in set(used)}
    out = ROOT / "SharedUI" / "Localizable.xcstrings"
    out.write_text(json.dumps(catalog(entries), ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    sc = ROOT / "SharedUI" / "AppShortcuts.xcstrings"
    sc.write_text(json.dumps(catalog(SHORTCUT_PHRASES), ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    unused = sorted(set(CS) - set(used))
    if unused:
        print("Unused translations:", unused)
    print(f"{len(entries)} strings, {len(SHORTCUT_PHRASES)} shortcut phrases")

main()
