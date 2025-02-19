# Development Notes

## Switching to conversation at a time mode.

Working with live interactions is a challenge. Since I can't use the live mode
for anything but voice, I'm forced to call out to other APIs for transcription,
translation and hints. This brings a higher latency than I want for responses.
If instead we captured inputs and then fed everything through in one request,
we'd get responses and hints simultaneously, and the model would be reusing the
same information.

The downside here is the user will have to hit the record button over and over.
If I can detect speech idle, I can do this for them though...

https://github.com/otalk/hark
https://modelscope.cn/models/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch/summary

PyAnnote looks like a good option:
https://huggingface.co/pyannote/voice-activity-detection
https://github.com/juanmc2005/diart

Alternatively I tested Silero (https://github.com/snakers4/silero-vad) and it
seems pretty efficient (~100x vs realtime), so I should be able to run that on
short segments even with my CPU machine without issue.

So we'd:

* Continue to stream data to the server
* Wait for either VAD to trigger or trigger on the user manually stopping.
* Compute a combined output from the model
* Send individual messages.


## Chat message management

I'm not thrilled with how the history flow works now, especially with audio
messages. Adding some kind of turn counter seems like it would be helpful to
make it easier to keep track of what's happening. In particular, we have to deal
with things like Gemini not sending an end_of_turn via audio, but instead via an
empty text message.

An alternative representation might help: instead of grouping messages by type,
group them by role; that way we'd just show assistant audio, hints, and
translations etc in the same "pocket". This could be based on the turn counter