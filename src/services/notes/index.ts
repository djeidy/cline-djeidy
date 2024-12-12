import { Note, NoteCollection } from '../../shared/notes';
import crypto from 'crypto';

/**
 * Service for managing agent notes with in-memory storage and search capabilities.
 */
export class NoteService {
    private notes: NoteCollection;
    private readonly MAX_NOTES_SIZE = 1024 * 1024; // 1MB limit for notes collection
    private readonly CURRENT_VERSION = 1;

    constructor() {
        this.notes = {
            notes: [],
            version: this.CURRENT_VERSION
        };
    }

    /**
     * Saves a note to the collection
     */
    async saveNote(note: Note): Promise<Note> {
        try {
            // Calculate size of notes collection with new note
            const updatedNotes = [...this.notes.notes, note];
            const collectionSize = Buffer.from(JSON.stringify({
                notes: updatedNotes,
                version: this.CURRENT_VERSION
            })).length;

            // Check if size exceeds limit (1MB)
            if (collectionSize > this.MAX_NOTES_SIZE) {
                throw new Error('Notes collection exceeds size limit');
            }

            // Generate ID for new notes
            if (!note.id) {
                note.id = crypto.randomUUID();
            }

            // Update or add note
            const existingIndex = this.notes.notes.findIndex(n => n.id === note.id);
            if (existingIndex >= 0) {
                this.notes.notes[existingIndex] = note;
            } else {
                this.notes.notes.push(note);
            }

            return note;
        } catch (error) {
            if (error instanceof Error && error.message === 'Notes collection exceeds size limit') {
                throw error;
            }
            console.error('Error saving note:', error);
            return note;
        }
    }

    /**
     * Retrieves all notes
     */
    async getNotes(): Promise<NoteCollection> {
        return {
            notes: this.notes.notes,
            version: this.CURRENT_VERSION
        };
    }

    /**
     * Searches notes by content and tags
     */
    async searchNotes(query: string): Promise<Note[]> {
        try {
            const searchTerms = query.toLowerCase().split(/\s+/);

            return this.notes.notes.filter(note => {
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
            const contextTerms = new Set(
                taskContext.toLowerCase()
                    .split(/\s+/)
                    .filter(term => term.length > 3) // Filter out short words
            );

            // Score notes based on term overlap
            const scoredNotes = this.notes.notes.map(note => {
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
                    if (contextTerms.has(term)) {
                        matchCount++;
                    }
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
