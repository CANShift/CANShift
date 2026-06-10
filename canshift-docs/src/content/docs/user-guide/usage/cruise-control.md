---
title: "Cruise control"
description: "Comment utiliser la page cruise depuis l'écran."
sidebar:
  order: 1
---

Le dash inclut une page cruise control dédiée — quatre boutons en L autour d'un
affichage central de set-speed.

## Disposition

```
┌──────────┐  ┌──────────┐
│    −     │  │    +     │
│       ┌──┤  ├──┐       │
│       │  │  │  │       │
└───────┘  │  │  └───────┘
           │  │
        [ SET-SPEED ]
           │  │
┌───────┐  │  │  ┌───────┐
│       └──┤  ├──┘       │
│   SET    │  │   OFF    │
└──────────┘  └──────────┘
```

- **+ / −** ajustent le set-speed (typiquement par incréments de 1 km/h selon la
  config tuner).
- **SET** mémorise la vitesse actuelle comme set-speed et arme le cruise.
- **OFF** désarme le cruise — le badge "ON" disparaît du coin.

## L'indicateur "ON"

Quand le cruise est armé, le bouton OFF affiche un petit indicateur "ON" en
surimpression. Tap dessus pour désarmer.

## Pas de signal au centre ?

Si le centre affiche `0` au lieu du set-speed :

- Vérifie que ton ECU envoie le signal cruise (typiquement sur le frame ID
  configuré dans `signals.json` côté SET / cruise_setpoint).
- Le widget affiche `0` quand le signal est invalide (pas de frame reçu depuis
  >1 s). Détails dans [SignalStore](/technical/architecture/signal-store/).

## Détails techniques

Le rendu de la page cruise est non-trivial (formes en L, contraintes LVGL). Voir
[Cruise template](/technical/architecture/cruise-template/).
