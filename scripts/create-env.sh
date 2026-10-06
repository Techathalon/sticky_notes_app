STAGE=${2:-'*'}


if [ -z "$2" ]; then
    echo "❌ Error: Invalid stage value. ❌"
    exit 1
fi

# OS=$OSTYPE
find "$1" -name ".env.$STAGE" | sed -r 's/\.env.*.[[:alnum:]]+$//' | xargs -I{} cp "{}.env.$STAGE" "{}.env"
echo "-------> Moved .env.$STAGE to .env 👏"

