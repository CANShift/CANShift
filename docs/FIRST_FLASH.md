# CANShift — Premier flash

Marche à suivre complète depuis la réception du matériel jusqu'au dashboard live.

---

## Matériel nécessaire

- Elecrow CrowPanel 2.8" ESP32 HMI (SKU DIS05028H)
- Câble USB-C (données, pas charge uniquement)
- Adafruit CAN Pal (TJA1051T/3) + câble CAN (CANH/CANL vers MaxxECU)
- Mac avec PlatformIO et CANShift Studio installés

---

## Étape 1 — Premier flash firmware

### 1a. Brancher l'écran

Brancher le CrowPanel en USB sur le Mac. Vérifier que le port apparaît :

```bash
ls /dev/cu.usbserial-* /dev/cu.SLAB_* /dev/cu.wchusbserial*
```

Si rien n'apparaît : installer le driver CP210x (Silicon Labs) ou CH340 selon le chip USB du board.

### 1b. Flasher le firmware

```bash
cd canshift-firmware
pio run -e crowpanel_28 --target upload
```

L'écran reste noir pendant le flash (normal — le bootloader ESP32 est actif).

Après le flash, l'ESP32 reboot automatiquement. L'écran affiche :
- **Splash CANShift** (rouge, barre de progression)
- **Setup screen** — "Ready to configure" avec un point rouge qui pulse

C'est normal : il n'y a pas encore de config sur l'écran.

### 1c. Uploader les fichiers de config (SPIFFS)

```bash
pio run -e crowpanel_28 --target uploadfs
```

Cela envoie `dashboard.json` et `signals.json` dans la mémoire flash SPIFFS.

Après l'upload, faire un power cycle (débrancher/rebrancher). Le dashboard VR6 doit s'afficher.

---

## Étape 2 — Connexion depuis Studio

Ouvrir CANShift Studio. Dans l'onglet **Device** :

1. Cliquer **Refresh** pour lister les ports USB
2. Sélectionner le port du CrowPanel
3. Cliquer **Connect**

Studio envoie `GET_STATUS` — si le firmware répond, la connexion est établie et la version firmware s'affiche.

**Si le firmware n'est pas encore flashé** : Studio détecte l'absence de réponse et ouvre automatiquement le dialog de flash. Sélectionner une release et cliquer Flash — Studio gère tout via Web Serial (pas besoin de PlatformIO).

---

## Étape 3 — Calibration touch

La calibration par défaut est une estimation. Pour la précision :

1. Swipe **vers le bas** depuis le haut de l'écran → Settings s'ouvre
2. Tapper **Calibrate Touch**
3. Suivre les 5 points de calibration affichés à l'écran
4. La calibration est sauvegardée en NVS — pas besoin de refaire après reboot

Si le touch est décalé ou inversé (X/Y inversés), modifier dans `board_config.h` :
```cpp
#define TOUCH_SWAP_XY  1   // si X et Y sont inversés
#define TOUCH_INVERT_X 1   // si X est mirroir
#define TOUCH_INVERT_Y 1   // si Y est mirroir
```
puis refaire `pio run -e crowpanel_28 --target upload`.

---

## Étape 4 — Vérification CAN / MaxxECU

### 4a. Câblage CAN Pal

```
CAN Pal CTX  → ESP32 GPIO 22 (TWAI TX)
CAN Pal CRX  → ESP32 GPIO 21 (TWAI RX)
CAN Pal VCC  → 5V
CAN Pal GND  → GND
CAN Pal CANH → MaxxECU CAN H
CAN Pal CANL → MaxxECU CAN L
```

### 4b. Vérifier les frame IDs MaxxECU

Les IDs dans `signals.json` sont des **estimations** (0x370–0x375). Avant de les valider :

1. Ouvrir MaxxECU PC software
2. Aller dans **CAN → CAN Output**
3. Vérifier quels frames sont activés et leurs IDs réels
4. Si les IDs diffèrent → mettre à jour `signals.json` et repusher depuis Studio

### 4c. Utiliser le CAN scanner pour debug

Dans Studio, onglet **CAN Scanner** :
- Connecter l'écran via USB pendant que l'ECU tourne
- Les frames CAN bruts s'affichent en temps réel (ID + données hex)
- Comparer les IDs reçus avec ceux dans `signals.json`

### 4d. Confirmer le baud rate

`signals.json` est configuré à **500 kbps**. Vérifier que MaxxECU est configuré au même baud.
Si l'ECU est en 1000 kbps : modifier `canSpeedKbps` dans `signals.json` et `CAN_SPEED_KBPS` dans `board_config.h`.

---

## Troubleshooting

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Écran noir après flash | Mauvaise connexion SPI ou pin RST | Vérifier le câblage, tester avec `pio run -e sim` |
| Touch ne répond pas | Calibration incorrecte | Faire la calibration (Étape 3) |
| Touch inversé | SWAP_XY ou INVERT | Modifier `board_config.h` |
| Pas de signaux CAN | Mauvais frame IDs ou baud rate | CAN scanner + vérifier MaxxECU |
| RPM affiché mais pas temp | Timeout signal | Vérifier `timeoutMs` dans `signals.json` |
| Barre rouge en bas de l'écran | Erreur firmware active | Tapper la barre pour voir le détail |

---

## Structure des fichiers de config

Les configs sont dans `canshift-firmware/data/config/` et uploadées en SPIFFS.

```
data/config/
├── dashboard.json   ← Layout des pages et widgets
└── signals.json     ← Mapping CAN → signaux
```

Pour modifier le dashboard :
1. Éditer dans Studio ou directement en JSON
2. Soit **Push Config** depuis Studio (live, sans reflash)
3. Soit modifier le fichier et refaire `pio run --target uploadfs`

---

## Commandes utiles

```bash
# Build firmware
pio run -e crowpanel_28

# Flash firmware
pio run -e crowpanel_28 --target upload

# Upload SPIFFS (config + assets)
pio run -e crowpanel_28 --target uploadfs

# Build + flash en une commande
pio run -e crowpanel_28 --target upload --target uploadfs

# Mode simulation (sans hardware)
pio run -e sim

# Monitor série (logs firmware)
pio device monitor --baud 115200
```
