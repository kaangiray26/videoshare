import { createRouter, createWebHistory } from 'vue-router';
import Videoshare from '../components/Videoshare.vue';

const routes = [
    {
        path: "/",
        component: Videoshare,

    },
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router