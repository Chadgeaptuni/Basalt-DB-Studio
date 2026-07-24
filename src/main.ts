import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { theme } from "$lib/stores/theme.svelte";

// Apply the persisted theme before first paint to avoid a flash of the default.
theme.apply();

const app = mount(App, { target: document.getElementById("app")! });

export default app;
