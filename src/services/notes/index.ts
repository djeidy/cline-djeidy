import { Note, NoteCollection } from '../../shared/notes';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Service for managing agent notes with persistence and search capabilities.
 */
export class NoteService {
    private storageDir: string;
    private notesFile: string;
    private readonly MAX_NOTES_SIZE = 1024 * 1024; // 1MB limit for notes file
    private readonly CURRENT_VERSION = 1;

    constructor(globalStoragePath: string) {
        this.storageDir = path.join(globalStoragePath, 'notes');
        this.notesFile = path.join(this.storageDir, 'notes.json');
    }

    /**
     * Ensures the notes directory exists
     */
    private async ensureStorageExists(): Promise<void> {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        } catch (error) {
            throw new Error(`Failed to create notes directory: ${error}`);
        }
    }

    /**
     * Saves a note to storage
     */
    async saveNote(note: Note): Promise<Note> {
        await this.ensureStorageExists();

        try {
            const collection = await this.getNotes();

            // Generate ID for new notes
            if (!note.id) {
                note.id = crypto.randomUUID();
            }

            // Update or add note
            const existingIndex = collection.notes.findIndex(n => n.id === note.id);
            if (existingIndex >= 0) {
                collection.notes[existingIndex] = note;
            } else {
                collection.notes.push(note);
            }

            // Check size limits
            const contentSize = JSON.stringify(collection).length;
            if (contentSize > this.MAX_NOTES_SIZE) {
                throw new Error('Notes collection exceeds size limit');
            }

            await fs.writeFile(this.notesFile, JSON.stringify(collection, null, 2));
            return note;
        } catch (error) {
            throw new Error(`Failed to save note: ${error}`);
        }
    }

    /**
     * Retrieves all notes
     */
    async getNotes(): Promise<NoteCollection> {
        await this.ensureStorageExists();

        try {
            try {
                const content = await fs.readFile(this.notesFile, 'utf-8');
                const collection = JSON.parse(content) as NoteCollection;
                return {
                    notes: collection.notes || [],
                    version: collection.version || this.CURRENT_VERSION
                };
            } catch (error) {
                // Return empty collection if file doesn't exist or is invalid
                return {
                    notes: [],
                    version: this.CURRENT_VERSION
                };
            }
        } catch (error) {
            throw new Error(`Failed to get notes: ${error}`);
        }
    }

    /**
     * Searches notes by content and tags
     */
    async searchNotes(query: string): Promise<Note[]> {
        try {
            const collection = await this.getNotes();
            const searchTerms = query.toLowerCase().split(/\s+/);

            return collection.notes.filter(note => {
                const searchableContent = [
                    note.title.toLowerCase(),
                    ...note.content.map(c => c.toLowerCase()),
                    ...note.tags.map(t => t.toLowerCase())
                ].join(' ');

                return searchTerms.every(term => searchableContent.includes(term));
            });
        } catch (error) {
            console.error('Search failed, returning empty results:', error);
            return []; // Fallback to empty results on error
        }
    }

    /**
     * Finds notes relevant to the current task context using basic relevance scoring
     */
    async getRelevantNotes(taskContext: string): Promise<Note[]> {
        try {
            const collection = await this.getNotes();
            const contextTerms = new Set(
                taskContext.toLowerCase()
                    .split(/\s+/)
                    .filter(term => term.length > 3) // Filter out short words
            );

            // Score notes based on term overlap
            const scoredNotes = collection.notes.map(note => {
                const noteTerms = new Set(
                    [note.title, ...note.content, ...note.tags]
                        .join(' ')
                        .toLowerCase()
                        .split(/\s+/)
                        .filter(term => term.length > 3)
                );

                // Calculate term overlap
                let matchCount = 0;
                for (const term of noteTerms) {
                    if (contextTerms.has(term)) matchCount++;
                }

                // Calculate relevance score
                const relevanceScore = matchCount / Math.max(contextTerms.size, noteTerms.size);

                return {
                    ...note,
                    relevanceScore
                };
            });

            // Return notes with relevance score above threshold, sorted by score
            return scoredNotes
                .filter(note => note.relevanceScore > 0.1)
                .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
        } catch (error) {
            console.error('Relevance search failed, returning empty results:', error);
            return []; // Fallback to empty results on error
        }
    }
}
