# Community & Learning

**Last updated:** 2026-05-17

## Overview
A learning management system combined with a community platform. Create courses with modules and quizzes, assign learning paths, award badges, run community groups with events, share wins and deal insights, post discussions, and collect testimonials.

## Core Features
- **Courses** - Create structured courses with ordered modules, rich text content, and quizzes
- **Learning paths** - Curated sequences of courses assigned to users or mentoring relationships, with progress tracking
- **Quizzes** - Knowledge assessments with multiple question types, scoring, and pass thresholds
- **Badges** - Award achievement badges to users for completing milestones
- **Community groups** - Create public or private groups with membership roles and events
- **Community posts** - Discussion posts, questions, resources, and polls with likes and comments
- **Wins & testimonials** - Share success stories and collect feedback with ratings
- **Deal sharing** - Share pipeline deal snapshots with the community (metrics frozen at time of share)
- **Mentorships (community context)** - Browse and connect with mentors

## Getting Started
1. Create courses with modules and optional quizzes
2. Build learning paths that group courses together
3. Assign learning paths to team members or mentees
4. Set up community groups for team discussions or member collaboration
5. Encourage win sharing and testimonials

## Key Workflows

### Creating a course
Build a course with a name, description, and featured image. Add modules in order - each module has a title and rich text content. Attach quizzes to courses to test knowledge.

### Taking a quiz
Quizzes have a passing score (percentage). When a user submits, the system scores their answers against correct answers and records pass/fail. Multiple choice and true/false question types are supported.

### Learning path progress
Learning paths assigned to users track progress percentage from 0-100. Progress updates as users complete assigned courses. Mark as complete when all courses are finished.

### Community engagement
Users can create discussion posts, share wins with images, share deal snapshots (metrics frozen at share time), and write testimonials. Posts and wins support likes and comments. Groups have member roles: member, moderator, and admin.

## Business Rules
- Course content follows a strict hierarchy: Course > Modules (ordered) > Quizzes > Questions
- Quiz pass/fail is based on score vs passing_score threshold
- Deal share snapshots are frozen at share time - retrospective deal changes don't affect shared versions
- Badges are awarded with a timestamp on the user-badge pivot
- Community groups can be private (require invitation) or public (anyone can join)
- Post likes and comments counts are denormalised for fast listing

## Best Practices
- Structure courses in short, digestible modules rather than one long page
- Set realistic passing scores - 70% is a good starting point
- Use community wins as social proof on landing pages
- Create private groups for coaching cohorts or deal analysis teams
- Review testimonials regularly and feature the best ones

## Related Features
- **Mentoring OS** - Learning paths can be assigned within mentoring relationships
- **Pipeline Automation** - Deal sharing connects to pipeline deals
- **Carina Agent** - AI can recommend learning paths based on user goals
