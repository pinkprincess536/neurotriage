# How It Works — EEG Seizure Triage Assistant

A plain-language explanation of the inference pipeline. Useful for presentations, interviews, and project documentation.

---

We start with a raw EEG recording stored as an EDF file. This recording may contain several hours of brain activity across multiple EEG channels. Before a machine learning model can analyze it, the data must be cleaned and converted into a format similar to what was used during training.

The first step is to load the EEG recording and select only the channels that the model was trained on. Different recordings may contain different channel configurations, so we ensure that the input matches the expected channel layout as closely as possible.

Next, we perform signal preprocessing. A bandpass filter is applied to remove very slow drifts and high-frequency noise that do not contain useful seizure information. A notch filter is then used to remove electrical interference from power lines. This helps improve signal quality and makes the EEG more consistent with the data used during training.

Once the signal is cleaned, the continuous recording is divided into smaller overlapping windows. Instead of analyzing an entire hour-long EEG at once, the model examines short segments, such as seven-second windows. Overlapping windows are used because seizure activity may occur near the boundary between two windows, and overlap reduces the risk of missing important events.

For every window, we also store its timestamp. This allows us to map predictions back to the original recording later. If the model detects seizure-like activity in a particular window, we can identify exactly where that window occurred in the EEG timeline.

After preprocessing, the trained model is loaded. Loading the model involves rebuilding the neural network architecture and restoring the learned weights that were saved after training. The architecture defines how the network is organized, while the weights contain the knowledge the model learned from the training data.

The model is then switched into evaluation mode. During training, certain layers such as dropout behave differently to improve generalization. During inference, we want stable and deterministic predictions, so evaluation mode ensures the model uses all of its learned knowledge.

Before making predictions, the new EEG windows are normalized using the same mean and standard deviation that were used during training. This is important because the model expects data to be scaled in the same way as the examples it learned from.

Each EEG window is then passed through the CNN. The convolutional layers act as feature extractors, learning to detect meaningful EEG patterns such as spikes, rhythmic activity, bursts, and other seizure-related characteristics. As the signal moves deeper through the network, these simple patterns are combined into more complex representations that are increasingly indicative of seizure activity.

Finally, the fully connected layers use these extracted features to classify each window as seizure or non-seizure. The model outputs a probability score for every window.

The prediction scores are then linked back to their timestamps. This allows us to identify the most suspicious parts of the recording and present them to a neurologist. Instead of manually reviewing hours of EEG data, the doctor can immediately focus on the segments most likely to contain seizures.

In summary, the system takes a raw EEG recording, cleans it, splits it into windows, processes each window through a trained CNN, and returns timestamped seizure probabilities. This transforms a long and difficult-to-review recording into a prioritized list of potentially important events, forming the foundation of an EEG seizure triage assistant.
