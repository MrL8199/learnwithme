package io.github.mrl8199.flashcard;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Draw behind the system bars on every Android version; the web app pads itself with
        // env(safe-area-inset-*) (Capacitor's SystemBars handles older WebViews).
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
