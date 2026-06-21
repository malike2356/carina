Claude, write Cursor action prompts for the remaining 17 specs.

Here is exactly what to do:

1. Read the build plan first:
   - /opt/lampp/htdocs/verlox/carina/chat.carinaai.uk/build-plan/AGENTS.md
   - /opt/lampp/htdocs/verlox/carina/chat.carinaai.uk/build-plan/TARGET.md

2. Read ALL 17 spec files from:
   /opt/lampp/htdocs/verlox/carina/chat.carinaai.uk/prompts/phase2-gap-closure/

   The specs are organized in 5 subdirectories:
   - 01-carina-core-gaps (3 files)
   - 02-scout-injection-dashboard (4 files)
   - 03-scout-detection-killswitch (4 files)
   - 04-scout-audit-deploy (3 files)
   - 05-website-promises (3 files)

3. For EACH spec file, write one Cursor action prompt. Write them here:
   /opt/lampp/htdocs/verlox/carina/chat.carinaai.uk/action-prompts/phase2-gap-closure/

   Create these subdirectories and place action prompts in the matching folder:
   - 01-carina-core-gaps/
   - 02-scout-injection-dashboard/
   - 03-scout-detection-killswitch/
   - 04-scout-audit-deploy/
   - 05-website-promises/

4. Every action prompt must follow the format in:
   /opt/lampp/htdocs/verlox/carina/chat.carinaai.uk/action-prompts/AGENTS.md

   Required sections: Goal, Context, Files to create, Files to modify, Step-by-step, Expected behavior, Test, Dependencies.

5. Rules:
   - One action prompt per spec file. Do not combine.
   - Write for Cursor, not a human. Cursor needs exact paths, exact commands, exact code.
   - PHP files: declare(strict_types=1), Laravel 12, PHP 8.2+
   - TypeScript files: strict mode, Node.js 18+
   - Every file must pass syntax check before completion.
   - No emojis. No em-dashes.
   - Include edge cases from the spec.
   - Reference project structure: Carina packages are at /opt/lampp/htdocs/verlox/carina/

6. Do not skip any of the 17 specs. Build them all.

These 17 specs close the gap between what carinaai.uk and labyrinthscout.com promise and what the codebase actually delivers. They are the difference between pricing pages without products and a real platform.
