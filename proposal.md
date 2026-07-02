1. A description of your project

We are going to make ModelPass. Our site will be one that lets users prepay for “credits” as they chat with different AI models, the credits will be used up, until they need to purchase more. We want to focus on creating a good user experience, and allow access to many different AI models.

2. A list of the team members

Nathan Escujuri
Troy Owens
Garrett Helms

3. A list of the technologies you will use

Express
Vite
Openrouter
Polar.SH (Billing)
WorkOS (Authentication)
Svelte
MongoDB
Netlify
GitHub
Git
Neovim btw… (the one true vim)

4. Your team management/communication strategy

We plan on doing most of our communication through MS teams. And we will create/assign trello cards together in class so that we will know what to do and who is doing it. We will also maintain a weekly standup meeting so that we can have a good feel for team progress and blockers.

5. A list of the core features you will implement
   A good looking/responsive chat interface
   User/profile management
   Chat history/storage
   Credit purchases/view remaining balance
   Model selector

6. A list of additional features you may implement

Analytics
Cloud agent

7. Wireframes or mockups of the user interface

8. Your initial database schema

WorkOS our authentication micro service will store user data and generate a user id.
Polar.sh our billing platform will store credit card information and usage info as well.

Chats collection:
User_id: number
Chats[]:
Id: number
Title: string
Model: string
Messages[]:
Timestamp: DateTime
Issuer: “user” | “model”
Text: string
Tokens used: number
Credits used: number
Users collection:
User_id: number
Customer_id: number
Default model: string
Reply style: string
Tokens used: number

Models collection:
Model_slug: string
Description: string
Cost: string

9. A list of the API endpoints you will need to implement

/login
/sign-up
/logout
/chats
/profile
/billing
/send-message/${chatId}
