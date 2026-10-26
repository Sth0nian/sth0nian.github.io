let articles = [
    {
        "title": "<h1>Sixteen Months Later - The fool finished his errand</h1>",
        "tags": [
            "running",
            "writing"
        ],
        "date": "2026-10-26 15:00",
        "body": [
            "So much for \"see you in 6 months\".",
            "That was June last year. Sixteen months later I am sheepishly opening the editor again. My writing streak has an even worse track record than my running streak, and for a whole year that one was actually going really well.",
            "So, the update I owe you (and myself): I finished it. Every single day of 2025. 365 days, 368 runs (three days had two). 3km a day in January, one more km every month, all the way up to 14km a day in December. On the 31st of December I ran my last 14km of the year and Strava tells me the whole thing added up to 3,152km. I am still not sure which part surprises me more, that number or the fact that I did not miss a single day.",
            "Working with data for a living I could not help myself, so here are some more numbers from the year:",
            "**3,152km** in total, which is Amsterdam to Lisbon as the crow flies. And then most of the way back. **278 hours** of actually moving. That is more than eleven full days of running. **14,845m** of climbing, about one and two thirds of an Everest. In the Netherlands. I am as confused as you are. **8.6km** per run on average, at about 5:18 per km. **15km** was the longest single run (20th of December) and **20.7km** the biggest day (30th of December, two runs, December does not mess around). **322** kudos on Strava. Thank you, every single one of them got me out of the door at least once.",
            "And because a list of numbers is never as good as a graph, here is every run since the 1st of January 2025. Scroll or pinch to zoom, drag to pan, and you can see exactly where the wheels came off.",
            "{{embed /charts/runs.html}}",
            "The funny thing about finishing a challenge is that nobody tells you what to do on January 1st. No rule, no km target, no little voice saying \"today is a 3km day\". Well, there was a little voice. Just not that one.",
            "King : Done! A whole year! Inner-voice King : Well done. You've earned a rest. King : I have, haven't I? Inner-voice King : A day. Maybe two. King : ... Inner-voice King : Maybe a month. Or ten. :devil:",
            "The dashboard does not lie (I built it that way, unfortunately). I ran about half the days in January, 8 in February, 2 in March and not once in July. Remember the nugget of wisdom from last time, 21 days to form a habit and 4 days to break it? It turns out it is not quite that symmetrical. It took me a year to build it and a couple of weeks to let it go.",
            "In my defence I have not been completely idle. Instead of writing here I have apparently been rebuilding this site. The TechJourney page is now a dungeon crawler, complete with a sarcastic bat. Priorities.",
            "Today I went for a run. 5km. Not 14, not even the 10 I was doing in June, just 5. And it was fine. Better than fine actually, because the conversation before the run was a lot shorter than it has been all year.",
            "So here is the plan, such as it is: start again, small. I am not going to promise every day. I am going to promise today, and then try that again tomorrow. Same with the writing.",
            "See you in 6 months. (I'll aim for less this time.)"
        ]
    },
    {
        "title": "<h1>Eight Months Later - A fools errand.</h1>",
        "tags": [
            "running"
        ],
        "date": "2025-06-18 09:11",
        "body": [
            "So much for writing every week/month.",
            "Honestly the funniest thing was I would have forgotten this had I never started running. Let me explain.",
            "On January 1st I had gone running with my partner and her brother. A fools errand for sure and especially for someone as out of shape as myself. They promised a 3km run only. To start the new year. It was almost 3km away from home that they turned around and 5km later I have never felt so out of condition in my entire life. I decided to start on another fools errand, I would run every day this month.",
            "But how? What would the structure be? I remember a wise nugget of wisdom the Data Architect on my team at work dropped on us: it takes 21 days to form a habit, 4 days to break it. I figured, if I get to 21 January the last 10 days would be easy. the first week was hell. The second week worse. The third week slightly less work. Here you would be expecting an \"and suddenly it was all better!\". Alas, the fourth week went back to being hard again. However I did notice that somewhere along the way I stopped having that conversation with myself before a run that usually went like this:",
            "King : OK! Run time Inner-voice King : But why? You hate running King : That's true... Inner-voice King : How about an early night? King : Oh that sounds not a bad idea actually Inner-voice : Yesss... :devil:",
            "On February 1st, I thought well one more month and one more km per day.",
            "6 months later and I have so far added one more km per day and am now at 8km per day. I don't know if it got easier on the actual run, but it has become very much a habit, im no longer out of breath, find that the incremental kilometer per month extra is hardly noticeable and generally that (and corroborated with a seemingly arbitrary metric from strava) I feel a fair bit fitter.",
            "Working with Data and connections between systems I decided to create a small dashboard, automate it and have it hosted [here](https://sth0nian.github.io/x-km-per-day/) with code hosted [here](https://github.com/Sth0nian/x-km-per-day). Then I stumbled on this fun \"blog\" and decided to write it here.",
            "See you in 6 months."
        ]
    },
    {
        "title": "<h1>Three days later</h1>",
        "tags": [
            "writing",
            "personalprojects",
            "minecraft"
        ],
        "date": "2024-10-23 22:06",
        "body": [
            "So much for writing every day.",
            "Today I had the idea to set myself a task to complete before the last day of my sabbatical. I have GCP access, AWS trial and can get an Azure one too. I will write a terraform module that will deploy to all three solutions, run some stress testing (perhaps spawning 1000 chickens) and then logging back the numbers / errors to a single file (including all the names of the chickens and which ones had problems).",
            "I want to do it in Terraform on Gitlab.com and hopefully it will require that I write some golang upskilling to create my own terraform provider and get it to perform specific functions like configuration changes to the server resources (backing up, turning off vm, imaging, creating larger container / vm, restoring vm, testing vm and destroying old vm), changing game mode on a running server (executing vm- / container-level commands on an existing container that doesnt require a rebuild) and pulloing stats out of a running instance to create dashboards.",
            "It's definitely going to have chickens in it."
        ]
    },
    {
        "title": "<h1>Theres an itch that needs scratching</h1>",
        "tags": [
            "writing",
            "nosubject"
        ],
        "date": "2024-10-20 17:26",
        "body": [
            "For the longest time, I have found myself wanting to write. What exactly it is that spurred this on I cannot say, but the truth of the matter is that it was always somewhat stuck in the back of my mind. A few people closer to me know that I started a novel during a period of time where I had to travel a lot for work and had extended amounts of time on airplanes and sat on the floor of airport lounges. While shuffling through those hubs of overpriced goods, gaggles of pilots and flight-attendents and the general bustle of people lining up for food they would never normally eat elsewhere, inspiration hit and I just started writing. There was no identifiable motivation, I had no guidance and only a vague idea of what I wanted to write.",
            "That was 6 years ago and the 5 chapters and 15,000 words later, the novel still remains unfinished and waiting for me to return. Today, of all days, two thirds of my way through a 3 month sabbatical, that same feeling hit. Opening my laptop for no real reason I opened up my editor and started writing this. Also, I wrote this. For no real reason. I am scared that this random bit of inspiration will leave me again so I am putting it online, setting a daily reminder for myself to write something (really anything) and just getting on with it.",
            "Hopefully some form of objective to this writing presents itself on this journey (though perhaps \"clueless wanderings\" is more apt)."
        ]
    }
];