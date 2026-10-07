default:
    @just --list

# Create and push a specific tag
tag VERSION:
    #!/usr/bin/env bash
    if [[ ! "{{ VERSION }}" =~ ^v.+ ]]; then
        echo "Version must start with v"
        exit 1
    fi

    read -p "Are you sure to create and push tag {{ VERSION }}? [y/N] " REPLY
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        exit 0
    fi

    git tag {{ VERSION }}
    git push origin {{ VERSION }}

# Delete a specific tag
dtag VERSION:
    #!/usr/bin/env bash
    if [[ ! "{{ VERSION }}" =~ ^v.+ ]]; then
        echo "Version must start with v"
        exit 1
    fi

    read -p "Are you sure to delete and push tag {{ VERSION }}? [y/N] " REPLY
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operation cancelled"
        exit 0
    fi

    git tag -d {{ VERSION }}
    git push origin --delete {{ VERSION }}
