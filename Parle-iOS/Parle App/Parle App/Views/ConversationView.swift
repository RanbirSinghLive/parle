import SwiftUI

/// Main voice conversation interface.
///
/// Port of app/conversation/page.tsx — the iOS version is dramatically
/// simpler because AVFoundation doesn't need gesture-context workarounds.
struct ConversationView: View {
    @StateObject private var vm = ConversationViewModel()
    @EnvironmentObject var authVM: AuthViewModel

    @State private var lessonTopic: String?
    @State private var showLessonPicker = false

    var body: some View {
        NavigationStack {
            Group {
                if let summary = vm.sessionSummary {
                    SessionSummaryView(
                        summary: summary,
                        onStartNew: {
                            vm.clearSession()
                            Task { await vm.startSession() }
                        },
                        onGoToDashboard: {
                            vm.clearSession()
                        }
                    )
                } else {
                    conversationContent
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Text("Parle")
                        .font(.headline)
                        .foregroundStyle(.white)
                }
                ToolbarItem(placement: .navigationBarLeading) {
                    if vm.isSessionActive {
                        Button("End") {
                            Task { await vm.endSession() }
                        }
                        .foregroundStyle(.white.opacity(0.8))
                        .disabled(vm.isEndingSession || vm.messages.isEmpty)
                    }
                }
            }
            .toolbarBackground(Color("PrimaryBlue"), for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            await vm.setup(userId: authVM.userId)
            if !vm.isSessionActive {
                showLessonPicker = true
            }
        }
        .sheet(isPresented: $showLessonPicker) {
            LessonPickerView(
                onSelectFreeConversation: {
                    showLessonPicker = false
                    Task { await vm.startSession() }
                },
                onSelectLesson: { topic in
                    showLessonPicker = false
                    Task { await vm.startSession(mode: .structuredLesson, topic: topic) }
                }
            )
        }
    }

    // MARK: - Conversation Content

    private var conversationContent: some View {
        VStack(spacing: 0) {
            // Microphone error banner
            if let error = vm.microphoneError {
                microphoneErrorBanner(error)
            }

            // Transcript
            TranscriptView(
                messages: vm.messages,
                isProcessing: vm.isProcessing
            )

            // Push-to-talk button
            PushToTalkButton(
                isRecording: vm.isRecording,
                isProcessing: vm.isProcessing,
                isSpeaking: vm.isSpeaking,
                onStart: { vm.startRecording() },
                onStop: { vm.stopRecording() }
            )
            .padding(.horizontal)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial)
        }
    }

    // MARK: - Error Banner

    private func microphoneErrorBanner(_ error: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Button {
                vm.microphoneError = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Color.orange.opacity(0.1))
    }
}
