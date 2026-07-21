# Rapport DataToCare AI — finalisation

- VM IP : 192.168.102.130
- VM utilisée : Ubuntu 64-bit Arm Server 26.04 (VM disponible, malgré l'hypothèse Ubuntu 24.04)
- Modèle de base : qwen2.5:3b-instruct (taille : 1.9 GB)
- Modèle custom : datatocare-qwen3b:latest (créé à 2026-05-15T09:46:49Z)
- Port API : 11434 (écoute sur 0.0.0.0 : oui, `*:11434`)
- Pare-feu : UFW actif, règles : OpenSSH 22/tcp et 11434/tcp autorisés en IPv4/IPv6
- Accès depuis l'hôte : OK (`curl http://192.168.102.130:11434/api/tags`)
- Smoke test /api/chat : OK, `.message.content` JSON parsable avec `intent`, `collection`, `pipeline`, `resultShape`, `assumptions`, `needsClarification`, `confidence`, `explain`
- Étapes manuelles restantes : compléter `schema_pack_datatocare_v1.md` avec les schémas réels du repo analytics

## Décisions automatiques prises

- Utilisé la VM trouvée dans `/Volumes/Extreme SSD/Virtual Machine/Ubuntu 64-bit Arm Server 26.04.vmwarevm`.
- Démarré la VM via VMware Fusion avec interface, car le démarrage `nogui` ne restait pas visible comme VM active.
- Activé SSH pour l'utilisateur invité `anatole`, puis installé la clé publique hôte dans `authorized_keys`.
- Réparé l'installation partielle d'Ollama en créant l'utilisateur système `ollama` et l'unité systemd `ollama.service`, car le premier run avait installé le binaire sans service.
- Étendu le volume logique racine de 10 GB à environ 17 GB avec l'espace LVM déjà disponible.
- Ajouté un swapfile persistant de 4 GB pour éviter l'OOM pendant l'inférence.

## Avertissements / bugs rencontrés

- La VM est Ubuntu 26.04 ARM, pas Ubuntu Server 24.04.
- Le disque racine initial était trop petit pour les modèles (`no space left on device` pendant le pull).
- Deux tests `/api/chat` lancés en parallèle ont déclenché l'OOM killer sur `ollama.service`; les validations finales ont été relancées séquentiellement après activation du swap.
- L'espace libre final sur `/` est bas, environ 1.7 GB après modèles et swap.
- Le schéma contient encore des TODO volontaires; il n'a pas été modifié.

## Validation finale

- `ollama list` contient `qwen2.5:3b-instruct` et `datatocare-qwen3b:latest`.
- `systemctl is-active ollama` retourne `active`.
- `systemctl is-enabled ollama` retourne `enabled`.
- `ss -tlnp | grep 11434` montre une écoute sur `*:11434`.
- Depuis l'hôte, `/api/tags` retourne les deux modèles.
- Depuis l'hôte, `/api/chat` avec `test_request.json` retourne un JSON parsable dans `.message.content`.
