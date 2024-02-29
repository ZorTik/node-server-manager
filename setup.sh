npm install
npx prisma generate
npx prisma migrate dev --name $1
echo "------------------------------------"
echo "Dependencies setup complete!"
echo "Please configure .env from .env.example"
echo "and config.yml."
echo "------------------------------------"