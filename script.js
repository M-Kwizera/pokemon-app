const API_BASE = "https://pokeapi.co/api/v2";
const PAGE_SIZE = 20;

const pokemonGrid = document.getElementById("pokemon-grid");
const searchInput = document.getElementById("search-input");
const typeFilter = document.getElementById("type-filter");
const sortFilter = document.getElementById("sort-filter");
const loadMoreButton = document.getElementById("load-more");
const resultCount = document.getElementById("result-count");
const pokemon = [];
const favorites = new Set();
let offset = 0;
let totalPokemon = 0;
let isLoading = false;

const typeColors = {
    normal: ["#efeee9", "#716f68"], fire: ["#fce8df", "#c65b3c"], water: ["#e3eef9", "#4d79aa"],
    electric: ["#fcf2d6", "#a77c18"], grass: ["#e7f1e3", "#5e8954"], ice: ["#e2f3f3", "#548c8d"],
    fighting: ["#f7e4e2", "#a74e49"], poison: ["#f0e5f2", "#875a91"], ground: ["#f4ebdc", "#987744"],
    flying: ["#eceafa", "#7167a5"], psychic: ["#fae5ed", "#ae5378"], bug: ["#edf1dc", "#768644"],
    rock: ["#eee9dc", "#877a54"], ghost: ["#eae7f3", "#6d638e"], dragon: ["#e8e6f7", "#6757a6"],
    dark: ["#e9e6e4", "#665d58"], steel: ["#e7ebef", "#687583"], fairy: ["#f8e7f0", "#a65d80"]
};

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function showMessage(title, description, canRetry = false) {
    pokemonGrid.replaceChildren();
    const message = document.createElement("div");
    message.className = "message";
    const heading = document.createElement("strong");
    heading.textContent = title;
    message.append(heading, document.createTextNode(description));

    if (canRetry) {
        const retryButton = document.createElement("button");
        retryButton.className = "retry-button";
        retryButton.type = "button";
        retryButton.textContent = "Try again";
        retryButton.addEventListener("click", loadPokemon);
        message.append(retryButton);
    }

    pokemonGrid.append(message);
}

function updateSummary() {
    document.getElementById("discovered-count").textContent = pokemon.length.toLocaleString();
    document.getElementById("favorite-count").textContent = `${favorites.size} Pokémon`;
    const strongest = pokemon.reduce((best, entry) => entry.power > (best?.power ?? -1) ? entry : best, null);
    document.getElementById("strongest-name").textContent = strongest
        ? `${capitalize(strongest.name)} · ${strongest.power}`
        : "—";
}

function updateTypeOptions() {
    const selected = typeFilter.value;
    const types = [...new Set(pokemon.flatMap((entry) => entry.types))].sort();
    typeFilter.replaceChildren(new Option("All types", "all"));
    types.forEach((type) => typeFilter.add(new Option(capitalize(type), type)));
    typeFilter.value = types.includes(selected) ? selected : "all";
}

function createCard(entry) {
    const card = document.createElement("article");
    card.className = "pokemon-card";

    const top = document.createElement("div");
    top.className = "card-top";
    const number = document.createElement("span");
    number.className = "pokemon-number";
    number.textContent = `#${String(entry.id).padStart(3, "0")}`;

    const favoriteButton = document.createElement("button");
    favoriteButton.className = `favorite-button${favorites.has(entry.id) ? " is-favorite" : ""}`;
    favoriteButton.type = "button";
    favoriteButton.textContent = favorites.has(entry.id) ? "♥" : "♡";
    favoriteButton.setAttribute("aria-label", `${favorites.has(entry.id) ? "Remove" : "Add"} ${capitalize(entry.name)} ${favorites.has(entry.id) ? "from" : "to"} favorites`);
    favoriteButton.setAttribute("aria-pressed", String(favorites.has(entry.id)));
    favoriteButton.addEventListener("click", () => {
        favorites.has(entry.id) ? favorites.delete(entry.id) : favorites.add(entry.id);
        updateSummary();
        renderPokemon();
    });
    top.append(number, favoriteButton);

    const artwork = document.createElement("div");
    artwork.className = "artwork";
    artwork.style.setProperty("--tint", typeColors[entry.types[0]]?.[0] ?? "#f4f3ee");
    const image = document.createElement("img");
    image.src = entry.image;
    image.alt = capitalize(entry.name);
    image.loading = "lazy";
    image.decoding = "async";
    artwork.append(image);

    const name = document.createElement("h3");
    name.className = "pokemon-name";
    name.textContent = entry.name;

    const details = document.createElement("div");
    details.className = "card-details";
    const tags = document.createElement("div");
    tags.className = "type-list";
    entry.types.forEach((type) => {
        const tag = document.createElement("span");
        tag.className = "type-tag";
        tag.textContent = type;
        tag.style.setProperty("--type-bg", typeColors[type]?.[0] ?? "#efefec");
        tag.style.setProperty("--type-ink", typeColors[type]?.[1] ?? "#686761");
        tags.append(tag);
    });
    const power = document.createElement("span");
    power.className = "power";
    const powerValue = document.createElement("strong");
    powerValue.textContent = entry.power;
    power.append(document.createTextNode("PWR "), powerValue);
    details.append(tags, power);

    const statBar = document.createElement("div");
    statBar.className = "stat-bar";
    statBar.setAttribute("role", "img");
    statBar.setAttribute("aria-label", `Base stat total: ${entry.power} out of 720`);
    const statFill = document.createElement("div");
    statFill.className = "stat-fill";
    statFill.style.width = `${Math.min(entry.power / 720 * 100, 100)}%`;
    statBar.append(statFill);

    const statLabel = document.createElement("div");
    statLabel.className = "stat-label";
    const statCaption = document.createElement("span");
    statCaption.textContent = "Base stat total";
    const statValue = document.createElement("span");
    statValue.textContent = `${entry.power} / 720`;
    statLabel.append(statCaption, statValue);

    const abilityButton = document.createElement("button");
    abilityButton.className = "ability-button";
    abilityButton.type = "button";
    abilityButton.textContent = "Meet this Pokémon";
    const abilityMessage = document.createElement("p");
    abilityMessage.className = "ability-message";
    abilityMessage.setAttribute("aria-live", "polite");
    abilityButton.addEventListener("click", () => {
        abilityMessage.textContent = `I am ${entry.name} and I have ${entry.ability}.`;
    });

    card.append(top, artwork, name, details, statBar, statLabel, abilityButton, abilityMessage);
    return card;
}

function renderPokemon() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedType = typeFilter.value;
    const sort = sortFilter.value;
    const filtered = pokemon.filter((entry) => {
        const matchesName = !query || entry.name.includes(query);
        const matchesType = selectedType === "all" || entry.types.includes(selectedType);
        return matchesName && matchesType;
    });

    if (sort === "power-desc") filtered.sort((a, b) => b.power - a.power);
    if (sort === "power-asc") filtered.sort((a, b) => a.power - b.power);
    if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "number") filtered.sort((a, b) => a.id - b.id);

    pokemonGrid.replaceChildren();
    if (filtered.length === 0) {
        showMessage("No Pokémon found", "Try another name or choose a different type.");
    } else {
        filtered.forEach((entry) => pokemonGrid.append(createCard(entry)));
    }
    resultCount.textContent = `Showing ${filtered.length} of ${pokemon.length} discovered Pokémon`;
    loadMoreButton.hidden = offset >= totalPokemon || pokemon.length === 0;
    pokemonGrid.setAttribute("aria-busy", String(isLoading));
}

async function loadPokemon() {
    if (isLoading) return;

    isLoading = true;
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Loading Pokémon...";
    pokemonGrid.setAttribute("aria-busy", "true");
    if (pokemon.length === 0) {
        resultCount.textContent = "Loading your Pokédex...";
        showMessage("Finding Pokémon...", "Fetching the Pokédex and getting your collection ready.");
    }

    try {
        const response = await fetch(`${API_BASE}/pokemon?limit=${PAGE_SIZE}&offset=${offset}`);
        if (!response.ok) throw new Error(`PokéAPI returned ${response.status}.`);

        const page = await response.json();
        if (!Array.isArray(page.results) || page.results.length === 0) {
            throw new Error("PokéAPI did not return any Pokémon for this page.");
        }

        const details = await Promise.all(page.results.map(async (item) => {
            const detailResponse = await fetch(item.url);
            if (!detailResponse.ok) throw new Error(`Could not load ${item.name}.`);
            const detail = await detailResponse.json();
            const image = detail.sprites.other?.["official-artwork"]?.front_default || detail.sprites.front_default;
            if (!image) throw new Error(`No image is available for ${item.name}.`);

            return {
                id: detail.id,
                name: detail.name,
                image,
                ability: detail.abilities[0]?.ability.name ?? "no recorded ability",
                types: detail.types.map((type) => type.type.name),
                power: detail.stats.reduce((sum, stat) => sum + stat.base_stat, 0)
            };
        }));

        pokemon.push(...details);
        offset += page.results.length;
        totalPokemon = page.count;
        updateTypeOptions();
        updateSummary();
        renderPokemon();
    } catch (error) {
        if (pokemon.length === 0) {
            resultCount.textContent = "Pokédex unavailable";
            showMessage("Couldn't load the Pokédex", `${error.message} Check your internet connection and try again.`, true);
        } else {
            resultCount.textContent = `Showing ${pokemon.length} Pokémon · More couldn't be loaded`;
            loadMoreButton.textContent = "Retry loading Pokémon";
        }
    } finally {
        isLoading = false;
        loadMoreButton.disabled = false;
        pokemonGrid.setAttribute("aria-busy", "false");
        loadMoreButton.hidden = offset >= totalPokemon || pokemon.length === 0;
        if (pokemon.length > 0) loadMoreButton.textContent = "Load more Pokémon";
    }
}

searchInput.addEventListener("input", renderPokemon);
typeFilter.addEventListener("change", renderPokemon);
sortFilter.addEventListener("change", renderPokemon);
loadMoreButton.addEventListener("click", loadPokemon);
loadPokemon();
