import SwiftUI

/// Hold-to-record button with native haptic feedback.
///
/// Port of components/PushToTalkButton.tsx.
/// Uses DragGesture for press-and-hold detection.
struct PushToTalkButton: View {
    let isRecording: Bool
    let isProcessing: Bool
    let isSpeaking: Bool
    let onStart: () -> Void
    let onStop: () -> Void

    private var isDisabled: Bool {
        isProcessing || isSpeaking
    }

    private var label: String {
        if isRecording { return "Recording..." }
        if isProcessing { return "Thinking..." }
        if isSpeaking { return "Listening..." }
        return "Hold to Speak"
    }

    private var buttonColor: Color {
        if isRecording { return .red }
        if isDisabled { return Color(.systemGray3) }
        return Color.primaryBlue
    }

    var body: some View {
        Text(label)
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(buttonColor)
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .scaleEffect(isRecording ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: isRecording)
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in
                        guard !isRecording, !isDisabled else { return }
                        onStart()
                    }
                    .onEnded { _ in
                        guard isRecording else { return }
                        onStop()
                    }
            )
            .allowsHitTesting(!isDisabled)
            .opacity(isDisabled ? 0.6 : 1.0)
    }
}
