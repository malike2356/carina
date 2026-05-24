<?php

declare(strict_types=1);

return [
    'intro_message' => <<<'TXT'
I'm set up for HMO management in your workspace. Here's what I can help with:

- Check your compliance score and upcoming certificate renewals
- Log a fire alarm test or fire door inspection
- Draft a Section 8 notice from your tenant records
- Calculate per-room yield
- Check Awaab's Law SLA timers on open maintenance requests

What would you like to do?
TXT,

    'quick_chips' => [
        [
            'label' => "What's my compliance score?",
            'message' => "What's my HMO compliance score across my properties? Use the get_compliance_score tool for each HMO property if needed.",
        ],
        [
            'label' => 'Which rooms are void?',
            'message' => 'Which rooms are currently void across my HMO portfolio? Use get_void_rooms.',
        ],
        [
            'label' => 'Draft a Section 8',
            'message' => 'Help me draft a Section 8 notice for a tenant with rent arrears. Ask which tenancy if needed, then use draft_section_8.',
        ],
        [
            'label' => "What does Awaab's Law require?",
            'message' => "What does Awaab's Law require for HMO operators, and do I have any at-risk maintenance requests right now?",
        ],
    ],
];
