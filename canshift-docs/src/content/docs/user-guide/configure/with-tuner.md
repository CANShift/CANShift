---
title: "Configurer avec le Tuner"
description: "Éditer le dashboard depuis canshift-tuner (Web Serial)."
sidebar:
  order: 1
---

Le **Tuner** est une SPA web hébergée sur Vercel qui parle au dash via Web Serial.
Tu changes une couleur, déplaces un widget, ajoutes une page, puis tu cliques
"Burn" — le dash recharge la nouvelle config sans flash.

## Connexion

1. Branche le dash en USB.
2. Ouvre [canshift-tuner.vercel.app](https://canshift-tuner.vercel.app) dans Chromium.
3. Clique "Connect" en haut à droite, sélectionne le port série.

Le tuner liste les signaux disponibles, l'état CAN, et te laisse éditer les pages.

## Burn = écrire la config

Quand tu cliques "Burn", le tuner envoie l'envelope JSON complète au dash. Le dash :

1. Affiche l'overlay "Saving config…".
2. Écrit le fichier sur SPIFFS (atomique — ancien fichier renommé `.bak`).
3. Reload la config en mémoire.
4. Rebuilde les pages.

Si l'overlay reste rouge, va voir [Erreurs de burn](/user-guide/configure/burn-errors/).

## Schéma vs version firmware

Le firmware vérifie au démarrage que le schéma de `dashboard.json` correspond au
schéma compilé. Si tu re-flashes une version récente du firmware mais que ton
SPIFFS contient un vieux `dashboard.json`, l'ErrorBar affichera
`SCHEMA_MISMATCH` et le dash chargera la config par défaut.

Solution : ré-éditer + burn depuis le tuner (le tuner connaît le schéma courant
via `canshift-core`).
