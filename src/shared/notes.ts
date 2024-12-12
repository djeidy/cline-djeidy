/**
 * Types and interfaces for the note-taking system.
 * These types support persistent storage and retrieval of agent notes
 * across tasks and sessions.
 */

/**
 * Represents a single note created by an agent.
 */
export interface Note {
    /** Unique identifier for the note */
    id: string;

    /** Human-readable title of the note */
    title: string;

    /** Array of content lines/paragraphs */
    content: string[];

    /** Tags for categorizing and searching notes */
    tags: string[];

    /** IDs of tasks this note is associated with */
    taskIds: string[];

    /** Unix timestamp of note creation */
    timestamp: number;

    /** Unix timestamp of last note access */
    lastAccessed: number;

    /** Optional score indicating relevance to current context */
    relevanceScore?: number;
}

/**
 * Collection of notes with version tracking.
 */
export interface NoteCollection {
    /** Array of all notes */
    notes: Note[];

    /** Version number for tracking schema updates */
    version: number;
}
