<template>
    <div class="container pt-3">
        <div class="d-flex">
            <div class="d-flex flex-column flex-fill p-3">
                <div class="d-flex justify-content-center mb-3">
                    <a href="/" class="d-flex">
                        <h5 class="text-light pe-1">Videoshare</h5>
                        <div>
                            <img src="/favicon.svg" class="img-fluid bg-light rounded-5">
                        </div>
                    </a>
                </div>
                <div v-if="!state.connected" class="d-flex flex-column mb-3">
                    <span class="text-light mb-1">Start by selecting a video.</span>
                    <div class="input-group">
                        <input type="file" class="form-control" id="inputGroupFile04" aria-describedby="inputGroupFileAddon"
                            aria-label="Upload" @change="handleFileUpload">
                    </div>
                </div>
                <div v-if="state.loading" class="d-flex flex-column">
                    <span class="text-light">Loading...</span>
                    <div class="progress" role="progressbar" aria-label="Basic example" aria-valuenow="0" aria-valuemin="0"
                        aria-valuemax="100">
                        <div class="progress-bar" :style="{ width: state.progress + '%' }"></div>
                    </div>
                </div>
                <div v-if="state.loaded && peer && !state.connected" class="d-flex bg-light rounded mb-3">
                    <div class="d-flex flex-column flex-fill bg-light rounded px-2 py-1">
                        <span class="text-muted">Session</span>
                        <span class="text-dark text-nowrap">{{ peer.id }}</span>
                    </div>
                    <button id="btn-share" @click="shareSession">Share</button>
                </div>
                <div v-if="state.connected" class="d-flex flex-column">
                    <div class="form-floating mb-3">
                        <input type="text" class="form-control" id="floatingConnected" :value="state.connected_to" readonly>
                        <label for="floatingInput">Connected to</label>
                    </div>
                </div>
                <video v-show="state.connected" ref="video" class="shadow" controls loop></video>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Peer } from "peerjs";

const router = useRouter();

const peer = ref(null);
const conn = ref(null);
const call = ref(null);

const video = ref(null);
const stream = ref(null);
const controls = ref(false);

const state = ref({
    progress: 0,
    loaded: false,
    loading: false,
    streaming: false,
    connected: false,
    connected_to: null,
})

async function make_call() {
}

async function shareSession() {
    navigator.clipboard.writeText(
        window.location.origin + window.location.pathname + "?session=" + peer.value.id
    );
}

async function handle_open(id) {
    console.log('My peer ID is: ' + id);

    // Check router parameters
    if (!router.currentRoute.value.query.session) {
        return
    }

    // Connect
    conn.value = peer.value.connect(router.currentRoute.value.query.session);
    conn.value.on('data', handle_data);
    conn.value.on('open', () => {
        conn.value.send({
            type: "helo",
            id: id
        })
    });
}

async function handle_connection(connection) {
    controls.value = true;
    conn.value = connection;
    conn.value.on('data', handle_data);
    call.value = peer.value.call(state.value.connected_to, stream.value);
}

async function handle_call(call) {
    conn.value.send({
        type: "streaming",
    })
    call.answer();
    call.on('stream', async (remoteStream) => {
        // Set video events
        await add_video_events();

        // Set video source
        video.value.srcObject = remoteStream;
        video.value.load();
    });
}

async function handle_data(data) {
    // Video events
    if (data.type == "pause") {
        await remove_video_events();
        await video.value.pause();
        await add_video_events();
        return
    }

    if (data.type == "play") {
        await remove_video_events();
        await video.value.play();
        await add_video_events();
        return
    }

    if (data.type == "helo") {
        state.value.connected = true;
        state.value.connected_to = data.id;
        conn.value.send({
            type: "ehlo",
            id: peer.value.id
        })
        return
    }

    if (data.type == "ehlo") {
        state.value.connected = true;
        state.value.connected_to = data.id;
        return
    }

    if (data.type == "streaming") {
        controls.value = true;
        state.value.streaming = true;
        return
    }
}

async function add_video_events() {
    video.value.onplay = () => {
        conn.value.send({
            type: "play",
        })
    }

    video.value.onpause = () => {
        conn.value.send({
            type: "pause",
        })
    }
}

async function remove_video_events() {
    video.value.onplay = null;
    video.value.onpause = null;
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onloadstart = async (event) => {
        state.value.loading = true;
    };

    reader.onprogress = async (event) => {
        state.value.progress = (event.loaded / event.total) * 100;
    };

    reader.onload = async (event) => {
        // Set the file as the stream for peerjs call
        const res = event.target.result;

        // Convert to data url
        const blob = new Blob([new Uint8Array(res)], { type: file.type });
        const url = URL.createObjectURL(blob);

        // Set video events
        await add_video_events();

        // Set video source
        video.value.src = url;
        video.value.load();

        // Get stream
        stream.value = video.value.mozCaptureStream ? video.value.mozCaptureStream() : video.value.captureStream();
        state.value.loading = false;
        state.value.loaded = true;
    };

    reader.onerror = async (event) => {
        console.error(event);
    };

    reader.readAsArrayBuffer(file);
}

onMounted(() => {
    // Set peer
    peer.value = new Peer([crypto.randomUUID()], {
        config: {
            iceServers: [
                {
                    urls: "turn:standard.relay.metered.ca:80",
                    username: "77397e46d75792651d01f384",
                    credential: "c74eQOt8hmYsKfAN",
                },
                {
                    urls: "turn:standard.relay.metered.ca:443",
                    username: "77397e46d75792651d01f384",
                    credential: "c74eQOt8hmYsKfAN",
                },
            ]
        }
    });
    peer.value.on('open', handle_open);
    peer.value.on('connection', handle_connection);
    peer.value.on('call', handle_call);
});
</script>