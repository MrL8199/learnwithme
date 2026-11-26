package io.github.mrl8199.flashcard;

import android.content.Context;
import android.os.LocaleList;
import android.text.TextUtils;
import android.util.AttributeSet;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import com.getcapacitor.CapacitorWebView;

/**
 * Capacitor's WebView, plus a keyboard-language hint per text field.
 *
 * The web app (src/lib/keyboard.ts) calls window.FlashcardKeyboard.setLang("en" | "vi" | "")
 * when a field gets focus, from the field's lang attribute. The hint is passed to the
 * keyboard as EditorInfo.hintLocales: Gboard then switches to that language, if the user has
 * enabled it, so English answers are not mangled by Vietnamese Telex input.
 *
 * Used through res/layout/capacitor_bridge_layout_main.xml, which overrides Capacitor's layout.
 */
public class LangWebView extends CapacitorWebView {

    /** Language asked by the focused field ("" = no preference). Set from the JavaBridge thread. */
    private volatile String wanted = "";
    /** Language given to the keyboard by the last onCreateInputConnection. */
    private String applied = "";

    public LangWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
        // Added before the page loads, so it exists when the web app starts.
        addJavascriptInterface(new Bridge(), "FlashcardKeyboard");
    }

    private final class Bridge {

        @JavascriptInterface
        public void setLang(String lang) {
            String next = lang == null ? "" : lang.trim().toLowerCase();
            if (next.equals(wanted)) return;
            wanted = next;
            // Normally the keyboard (re)connects after this call and picks the hint up.
            // If it already connected with another language, reconnect it.
            postDelayed(
                () -> {
                    if (!wanted.equals(applied) && hasFocus()) {
                        InputMethodManager imm = (InputMethodManager) getContext().getSystemService(Context.INPUT_METHOD_SERVICE);
                        if (imm != null) imm.restartInput(LangWebView.this);
                    }
                },
                80
            );
        }
    }

    @Override
    public InputConnection onCreateInputConnection(EditorInfo outAttrs) {
        InputConnection connection = super.onCreateInputConnection(outAttrs);
        String lang = wanted;
        applied = lang;
        LocaleList locales = localesFor(lang);
        if (locales != null) outAttrs.hintLocales = locales;
        return connection;
    }

    private static LocaleList localesFor(String lang) {
        if (TextUtils.isEmpty(lang)) return null;
        if (lang.equals("en") || lang.startsWith("en-")) return LocaleList.forLanguageTags("en-US,en-GB");
        if (lang.equals("vi") || lang.startsWith("vi-")) return LocaleList.forLanguageTags("vi-VN");
        return LocaleList.forLanguageTags(lang);
    }
}
