# Project instructions

The user authorizes automatic production deployment after each prompt that changes this system. Complete appropriate checks, then deploy to the existing Sugar Inventory production project without asking for deployment confirmation. Deploy pending completed changes when the user requests deployment. Read-only questions do not require an unchanged redeployment. Report the deployment URL and any deployment failure honestly.

The established production URL is https://sugar-inventory.vercel.app/. Verify that exact URL after deployment. The CLI-linked project currently serves https://sugar-inventory-ruby.vercel.app/ under jcnino2020s-projects; deploying there does not update the established URL. Never report an alternate domain as completion of deployment to the established production site.

The user explicitly authorizes committing and pushing verified changes for their requested system updates to the shared default `main` branch, including future updates, to trigger automatic production deployment. Do not request this authorization again for changes within the requested scope.
