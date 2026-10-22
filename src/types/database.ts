export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_requests: {
        Row: {
          contract_version: number;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          kind: string;
          status: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          contract_version?: number;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          kind: string;
          status?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          contract_version?: number;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          status?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_requests_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_workspace_settings: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          enabled: boolean;
          id: string;
          policy_version: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          enabled?: boolean;
          id?: string;
          policy_version?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          enabled?: boolean;
          id?: string;
          policy_version?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_workspace_settings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_workspace_settings_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_questions: {
        Row: {
          assessment_id: string;
          competency_id: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          label: string;
          max_score: number;
          parent_question_id: string | null;
          topic_id: string | null;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assessment_id: string;
          competency_id?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          label: string;
          max_score: number;
          parent_question_id?: string | null;
          topic_id?: string | null;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assessment_id?: string;
          competency_id?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          label?: string;
          max_score?: number;
          parent_question_id?: string | null;
          topic_id?: string | null;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_questions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_questions_workspace_id_assessment_id_fkey";
            columns: ["workspace_id", "assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "assessment_questions_workspace_id_competency_id_fkey";
            columns: ["workspace_id", "competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "assessment_questions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_questions_workspace_id_parent_question_id_asses_fkey";
            columns: ["workspace_id", "parent_question_id", "assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessment_questions";
            referencedColumns: ["workspace_id", "id", "assessment_id"];
          },
          {
            foreignKeyName: "assessment_questions_workspace_id_topic_id_fkey";
            columns: ["workspace_id", "topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      assessment_results: {
        Row: {
          assessment_id: string;
          class_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          enrollment_id: string;
          id: string;
          notes: string | null;
          teaching_assignment_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assessment_id: string;
          class_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          enrollment_id: string;
          id?: string;
          notes?: string | null;
          teaching_assignment_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assessment_id?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          enrollment_id?: string;
          id?: string;
          notes?: string | null;
          teaching_assignment_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_results_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_results_workspace_id_assessment_id_class_id_fkey";
            columns: ["workspace_id", "assessment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "assessment_results_workspace_id_assessment_id_teaching_ass_fkey";
            columns: [
              "workspace_id",
              "assessment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["workspace_id", "id", "teaching_assignment_id"];
          },
          {
            foreignKeyName: "assessment_results_workspace_id_enrollment_id_class_id_fkey";
            columns: ["workspace_id", "enrollment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "assessment_results_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_rubrics: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_rubrics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_rubrics_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      assessments: {
        Row: {
          assessed_on: string;
          class_id: string;
          correction_mode: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          evaluation_rule_id: string | null;
          id: string;
          kind: string;
          rubric_id: string | null;
          teaching_assignment_id: string;
          title: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assessed_on: string;
          class_id: string;
          correction_mode: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          evaluation_rule_id?: string | null;
          id?: string;
          kind: string;
          rubric_id?: string | null;
          teaching_assignment_id: string;
          title: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assessed_on?: string;
          class_id?: string;
          correction_mode?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          evaluation_rule_id?: string | null;
          id?: string;
          kind?: string;
          rubric_id?: string | null;
          teaching_assignment_id?: string;
          title?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_default_rule_fk";
            columns: ["workspace_id", "evaluation_rule_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_rules";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "assessments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_workspace_id_rubric_id_fkey";
            columns: ["workspace_id", "rubric_id"];
            isOneToOne: false;
            referencedRelation: "assessment_rubrics";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "assessments_workspace_id_teaching_assignment_id_class_id_fkey";
            columns: ["workspace_id", "teaching_assignment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "teaching_assignments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
        ];
      };
      assignment_exercises: {
        Row: {
          assignment_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          id: string;
          position: number;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description: string;
          id?: string;
          position: number;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          position?: number;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_exercises_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_exercises_workspace_id_assignment_id_fkey";
            columns: ["workspace_id", "assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "assignment_exercises_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      assignment_topics: {
        Row: {
          assignment_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          topic_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          topic_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          topic_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_topics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_topics_workspace_id_assignment_id_fkey";
            columns: ["workspace_id", "assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "assignment_topics_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_topics_workspace_id_topic_id_fkey";
            columns: ["workspace_id", "topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      assignments: {
        Row: {
          assigned_on: string;
          class_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          due_on: string;
          id: string;
          teaching_assignment_id: string;
          title: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_on: string;
          class_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          due_on: string;
          id?: string;
          teaching_assignment_id: string;
          title: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assigned_on?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          due_on?: string;
          id?: string;
          teaching_assignment_id?: string;
          title?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_workspace_id_teaching_assignment_id_class_id_fkey";
            columns: ["workspace_id", "teaching_assignment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "teaching_assignments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
        ];
      };
      class_subjects: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          subject_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          subject_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          subject_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_subjects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_subjects_workspace_id_class_id_fkey";
            columns: ["workspace_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "class_subjects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_subjects_workspace_id_subject_id_fkey";
            columns: ["workspace_id", "subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      classes: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          name: string;
          school_id: string;
          school_year_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          school_id: string;
          school_year_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          school_id?: string;
          school_year_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_workspace_id_school_id_fkey";
            columns: ["workspace_id", "school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "classes_workspace_id_school_year_id_fkey";
            columns: ["workspace_id", "school_year_id"];
            isOneToOne: false;
            referencedRelation: "school_years";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      competencies: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          id: string;
          subject_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description: string;
          id?: string;
          subject_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          subject_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competencies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competencies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competencies_workspace_id_subject_id_fkey";
            columns: ["workspace_id", "subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      enrollments: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          ends_on: string | null;
          id: string;
          outcome: string | null;
          starts_on: string;
          student_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_on?: string | null;
          id?: string;
          outcome?: string | null;
          starts_on: string;
          student_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_on?: string | null;
          id?: string;
          outcome?: string | null;
          starts_on?: string;
          student_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_workspace_id_class_id_fkey";
            columns: ["workspace_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "enrollments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_workspace_id_student_id_fkey";
            columns: ["workspace_id", "student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      error_types: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description: string;
          id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "error_types_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "error_types_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_categories: {
        Row: {
          code: string;
          contributes_to_average: boolean;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          name: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          contributes_to_average?: boolean;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          code?: string;
          contributes_to_average?: boolean;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_categories_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_categories_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_rules: {
        Row: {
          conversion_points: NonNullable<Json>;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          maximum: number;
          minimum: number;
          name: string;
          rounding_step: number;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversion_points?: NonNullable<Json>;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          maximum: number;
          minimum: number;
          name: string;
          rounding_step?: number;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          conversion_points?: NonNullable<Json>;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          maximum?: number;
          minimum?: number;
          name?: string;
          rounding_step?: number;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_rules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_rules_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      grade_audit_log: {
        Row: {
          actor_id: string | null;
          created_at: string;
          grade_entry_id: string;
          id: string;
          new_record: NonNullable<Json>;
          old_record: Json | null;
          operation: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          grade_entry_id: string;
          id?: string;
          new_record: NonNullable<Json>;
          old_record?: Json | null;
          operation: string;
          workspace_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          grade_entry_id?: string;
          id?: string;
          new_record?: NonNullable<Json>;
          old_record?: Json | null;
          operation?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grade_audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grade_audit_log_workspace_id_grade_entry_id_fkey";
            columns: ["workspace_id", "grade_entry_id"];
            isOneToOne: false;
            referencedRelation: "grade_entries";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_audit_log_workspace_id_grade_entry_id_fkey";
            columns: ["workspace_id", "grade_entry_id"];
            isOneToOne: false;
            referencedRelation: "v_grade_register";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      grade_entries: {
        Row: {
          allow_behavior_in_average: boolean;
          assessment_result_id: string | null;
          calculation_snapshot: NonNullable<Json>;
          category_id: string;
          change_reason: string | null;
          class_id: string;
          confirmed_value: number | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          enrollment_id: string;
          excluded_from_average: boolean;
          graded_on: string;
          homework_check_id: string | null;
          id: string;
          observation_id: string | null;
          origin: string;
          rule_id: string;
          status: string;
          suggested_value: number | null;
          teaching_assignment_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          weight: number;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          allow_behavior_in_average?: boolean;
          assessment_result_id?: string | null;
          calculation_snapshot?: NonNullable<Json>;
          category_id: string;
          change_reason?: string | null;
          class_id: string;
          confirmed_value?: number | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          enrollment_id: string;
          excluded_from_average?: boolean;
          graded_on: string;
          homework_check_id?: string | null;
          id?: string;
          observation_id?: string | null;
          origin: string;
          rule_id: string;
          status?: string;
          suggested_value?: number | null;
          teaching_assignment_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          weight?: number;
          workspace_id: string;
        };
        Update: {
          allow_behavior_in_average?: boolean;
          assessment_result_id?: string | null;
          calculation_snapshot?: NonNullable<Json>;
          category_id?: string;
          change_reason?: string | null;
          class_id?: string;
          confirmed_value?: number | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          enrollment_id?: string;
          excluded_from_average?: boolean;
          graded_on?: string;
          homework_check_id?: string | null;
          id?: string;
          observation_id?: string | null;
          origin?: string;
          rule_id?: string;
          status?: string;
          suggested_value?: number | null;
          teaching_assignment_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          weight?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "grade_entries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_assessment_result_id_enrollment_fkey";
            columns: [
              "workspace_id",
              "assessment_result_id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: [
              "workspace_id",
              "id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_assessment_result_id_enrollment_fkey";
            columns: [
              "workspace_id",
              "assessment_result_id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "v_assessment_history";
            referencedColumns: [
              "workspace_id",
              "id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_category_id_fkey";
            columns: ["workspace_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_categories";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_enrollment_id_class_id_fkey";
            columns: ["workspace_id", "enrollment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_homework_check_id_fkey";
            columns: ["workspace_id", "homework_check_id"];
            isOneToOne: false;
            referencedRelation: "homework_checks";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_homework_check_id_fkey";
            columns: ["workspace_id", "homework_check_id"];
            isOneToOne: false;
            referencedRelation: "v_homework_completion";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_homework_check_id_fkey";
            columns: ["workspace_id", "homework_check_id"];
            isOneToOne: false;
            referencedRelation: "v_homework_summary";
            referencedColumns: ["workspace_id", "homework_check_id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_observation_id_enrollment_id_te_fkey";
            columns: [
              "workspace_id",
              "observation_id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "observations";
            referencedColumns: [
              "workspace_id",
              "id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_observation_id_enrollment_id_te_fkey";
            columns: [
              "workspace_id",
              "observation_id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "v_observation_history";
            referencedColumns: [
              "workspace_id",
              "id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_rule_id_fkey";
            columns: ["workspace_id", "rule_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_rules";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_teaching_assignment_id_class_id_fkey";
            columns: ["workspace_id", "teaching_assignment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "teaching_assignments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
        ];
      };
      homework_checks: {
        Row: {
          assignment_id: string;
          autonomy: number | null;
          checked_on: string;
          class_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          enrollment_id: string;
          excuse_reason: string | null;
          excused: boolean;
          id: string;
          notes: string | null;
          suggestions: string | null;
          understanding: number | null;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          autonomy?: number | null;
          checked_on: string;
          class_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          enrollment_id: string;
          excuse_reason?: string | null;
          excused?: boolean;
          id?: string;
          notes?: string | null;
          suggestions?: string | null;
          understanding?: number | null;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assignment_id?: string;
          autonomy?: number | null;
          checked_on?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          enrollment_id?: string;
          excuse_reason?: string | null;
          excused?: boolean;
          id?: string;
          notes?: string | null;
          suggestions?: string | null;
          understanding?: number | null;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_checks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_checks_workspace_id_assignment_id_class_id_fkey";
            columns: ["workspace_id", "assignment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "homework_checks_workspace_id_enrollment_id_class_id_fkey";
            columns: ["workspace_id", "enrollment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "homework_checks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      homework_errors: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          error_type_id: string;
          exercise_result_id: string;
          id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          error_type_id: string;
          exercise_result_id: string;
          id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          error_type_id?: string;
          exercise_result_id?: string;
          id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_errors_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_errors_workspace_id_error_type_id_fkey";
            columns: ["workspace_id", "error_type_id"];
            isOneToOne: false;
            referencedRelation: "error_types";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "homework_errors_workspace_id_exercise_result_id_fkey";
            columns: ["workspace_id", "exercise_result_id"];
            isOneToOne: false;
            referencedRelation: "homework_exercise_results";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "homework_errors_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      homework_exercise_results: {
        Row: {
          assignment_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          exercise_id: string;
          homework_check_id: string;
          id: string;
          notes: string | null;
          outcome: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assignment_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          exercise_id: string;
          homework_check_id: string;
          id?: string;
          notes?: string | null;
          outcome: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          exercise_id?: string;
          homework_check_id?: string;
          id?: string;
          notes?: string | null;
          outcome?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "homework_exercise_results_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_exercise_results_workspace_id_exercise_id_assignm_fkey";
            columns: ["workspace_id", "exercise_id", "assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignment_exercises";
            referencedColumns: ["workspace_id", "id", "assignment_id"];
          },
          {
            foreignKeyName: "homework_exercise_results_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "homework_exercise_results_workspace_id_homework_check_id_a_fkey";
            columns: ["workspace_id", "homework_check_id", "assignment_id"];
            isOneToOne: false;
            referencedRelation: "homework_checks";
            referencedColumns: ["workspace_id", "id", "assignment_id"];
          },
          {
            foreignKeyName: "homework_exercise_results_workspace_id_homework_check_id_a_fkey";
            columns: ["workspace_id", "homework_check_id", "assignment_id"];
            isOneToOne: false;
            referencedRelation: "v_homework_completion";
            referencedColumns: ["workspace_id", "id", "assignment_id"];
          },
          {
            foreignKeyName: "homework_exercise_results_workspace_id_homework_check_id_a_fkey";
            columns: ["workspace_id", "homework_check_id", "assignment_id"];
            isOneToOne: false;
            referencedRelation: "v_homework_summary";
            referencedColumns: [
              "workspace_id",
              "homework_check_id",
              "assignment_id",
            ];
          },
        ];
      };
      import_batches: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          kind: string;
          status: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          kind: string;
          status?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          status?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_batches_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      import_rows: {
        Row: {
          batch_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          duplicate_of: string | null;
          id: string;
          payload: NonNullable<Json>;
          resolution: string;
          row_number: number;
          updated_at: string;
          validation_errors: NonNullable<Json>;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          batch_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          duplicate_of?: string | null;
          id?: string;
          payload: NonNullable<Json>;
          resolution?: string;
          row_number: number;
          updated_at?: string;
          validation_errors?: NonNullable<Json>;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          batch_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          duplicate_of?: string | null;
          id?: string;
          payload?: NonNullable<Json>;
          resolution?: string;
          row_number?: number;
          updated_at?: string;
          validation_errors?: NonNullable<Json>;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "import_rows_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "import_rows_workspace_id_batch_id_fkey";
            columns: ["workspace_id", "batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "import_rows_workspace_id_duplicate_of_fkey";
            columns: ["workspace_id", "duplicate_of"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "import_rows_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_activities: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          id: string;
          lesson_id: string;
          position: number;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description: string;
          id?: string;
          lesson_id: string;
          position?: number;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          id?: string;
          lesson_id?: string;
          position?: number;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_activities_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_activities_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_activities_workspace_id_lesson_id_fkey";
            columns: ["workspace_id", "lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      lesson_topics: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          lesson_id: string;
          topic_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          lesson_id: string;
          topic_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          lesson_id?: string;
          topic_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_topics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_topics_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_topics_workspace_id_lesson_id_fkey";
            columns: ["workspace_id", "lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "lesson_topics_workspace_id_topic_id_fkey";
            columns: ["workspace_id", "topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      lessons: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          ends_at: string;
          id: string;
          notes: string | null;
          starts_at: string;
          status: string;
          teaching_assignment_id: string;
          title: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_at: string;
          id?: string;
          notes?: string | null;
          starts_at: string;
          status?: string;
          teaching_assignment_id: string;
          title: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_at?: string;
          id?: string;
          notes?: string | null;
          starts_at?: string;
          status?: string;
          teaching_assignment_id?: string;
          title?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lessons_workspace_id_teaching_assignment_id_fkey";
            columns: ["workspace_id", "teaching_assignment_id"];
            isOneToOne: false;
            referencedRelation: "teaching_assignments";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      observation_competencies: {
        Row: {
          competency_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          observation_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          competency_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          observation_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          competency_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          observation_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "observation_competencies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observation_competencies_workspace_id_competency_id_fkey";
            columns: ["workspace_id", "competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "observation_competencies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observation_competencies_workspace_id_observation_id_fkey";
            columns: ["workspace_id", "observation_id"];
            isOneToOne: false;
            referencedRelation: "observations";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "observation_competencies_workspace_id_observation_id_fkey";
            columns: ["workspace_id", "observation_id"];
            isOneToOne: false;
            referencedRelation: "v_observation_history";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      observation_errors: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          error_type_id: string;
          id: string;
          observation_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          error_type_id: string;
          id?: string;
          observation_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          error_type_id?: string;
          id?: string;
          observation_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "observation_errors_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observation_errors_workspace_id_error_type_id_fkey";
            columns: ["workspace_id", "error_type_id"];
            isOneToOne: false;
            referencedRelation: "error_types";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "observation_errors_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observation_errors_workspace_id_observation_id_fkey";
            columns: ["workspace_id", "observation_id"];
            isOneToOne: false;
            referencedRelation: "observations";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "observation_errors_workspace_id_observation_id_fkey";
            columns: ["workspace_id", "observation_id"];
            isOneToOne: false;
            referencedRelation: "v_observation_history";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      observation_topics: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          observation_id: string;
          topic_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          observation_id: string;
          topic_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          observation_id?: string;
          topic_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "observation_topics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observation_topics_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observation_topics_workspace_id_observation_id_fkey";
            columns: ["workspace_id", "observation_id"];
            isOneToOne: false;
            referencedRelation: "observations";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "observation_topics_workspace_id_observation_id_fkey";
            columns: ["workspace_id", "observation_id"];
            isOneToOne: false;
            referencedRelation: "v_observation_history";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "observation_topics_workspace_id_topic_id_fkey";
            columns: ["workspace_id", "topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      observation_types: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string;
          disciplinary_default: boolean;
          id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description: string;
          disciplinary_default?: boolean;
          id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string;
          disciplinary_default?: boolean;
          id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "observation_types_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observation_types_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      observations: {
        Row: {
          class_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          difficulties: string | null;
          enrollment_id: string;
          id: string;
          mode: string;
          notes: string | null;
          observable_behaviors: string | null;
          observation_type_id: string;
          observed_on: string;
          participation: string | null;
          strengths: string | null;
          teaching_assignment_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          difficulties?: string | null;
          enrollment_id: string;
          id?: string;
          mode: string;
          notes?: string | null;
          observable_behaviors?: string | null;
          observation_type_id: string;
          observed_on: string;
          participation?: string | null;
          strengths?: string | null;
          teaching_assignment_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          difficulties?: string | null;
          enrollment_id?: string;
          id?: string;
          mode?: string;
          notes?: string | null;
          observable_behaviors?: string | null;
          observation_type_id?: string;
          observed_on?: string;
          participation?: string | null;
          strengths?: string | null;
          teaching_assignment_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "observations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observations_workspace_id_enrollment_id_class_id_fkey";
            columns: ["workspace_id", "enrollment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "observations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observations_workspace_id_observation_type_id_fkey";
            columns: ["workspace_id", "observation_type_id"];
            isOneToOne: false;
            referencedRelation: "observation_types";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "observations_workspace_id_teaching_assignment_id_class_id_fkey";
            columns: ["workspace_id", "teaching_assignment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "teaching_assignments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      question_errors: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          error_type_id: string;
          id: string;
          question_result_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          error_type_id: string;
          id?: string;
          question_result_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          error_type_id?: string;
          id?: string;
          question_result_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_errors_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_errors_workspace_id_error_type_id_fkey";
            columns: ["workspace_id", "error_type_id"];
            isOneToOne: false;
            referencedRelation: "error_types";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "question_errors_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_errors_workspace_id_question_result_id_fkey";
            columns: ["workspace_id", "question_result_id"];
            isOneToOne: false;
            referencedRelation: "question_results";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      question_results: {
        Row: {
          assessment_id: string;
          assessment_result_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          max_score_snapshot: number;
          notes: string | null;
          question_id: string;
          quick_result: string | null;
          score: number | null;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assessment_id: string;
          assessment_result_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          max_score_snapshot: number;
          notes?: string | null;
          question_id: string;
          quick_result?: string | null;
          score?: number | null;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          assessment_id?: string;
          assessment_result_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          max_score_snapshot?: number;
          notes?: string | null;
          question_id?: string;
          quick_result?: string | null;
          score?: number | null;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_results_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_results_workspace_id_assessment_result_id_assessm_fkey";
            columns: ["workspace_id", "assessment_result_id", "assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: ["workspace_id", "id", "assessment_id"];
          },
          {
            foreignKeyName: "question_results_workspace_id_assessment_result_id_assessm_fkey";
            columns: ["workspace_id", "assessment_result_id", "assessment_id"];
            isOneToOne: false;
            referencedRelation: "v_assessment_history";
            referencedColumns: ["workspace_id", "id", "assessment_id"];
          },
          {
            foreignKeyName: "question_results_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "question_results_workspace_id_question_id_assessment_id_fkey";
            columns: ["workspace_id", "question_id", "assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessment_questions";
            referencedColumns: ["workspace_id", "id", "assessment_id"];
          },
        ];
      };
      rubric_criteria: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          label: string;
          levels: NonNullable<Json>;
          max_score: number;
          rubric_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          weight: number;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          label: string;
          levels: NonNullable<Json>;
          max_score: number;
          rubric_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          weight: number;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          label?: string;
          levels?: NonNullable<Json>;
          max_score?: number;
          rubric_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          weight?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rubric_criteria_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rubric_criteria_workspace_id_rubric_id_fkey";
            columns: ["workspace_id", "rubric_id"];
            isOneToOne: false;
            referencedRelation: "assessment_rubrics";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      rubric_scores: {
        Row: {
          assessment_result_id: string;
          created_at: string;
          created_by: string;
          criterion_id: string;
          criterion_label_snapshot: string;
          deleted_at: string | null;
          id: string;
          levels_snapshot: NonNullable<Json>;
          max_score_snapshot: number;
          score: number;
          updated_at: string;
          version: number;
          visibility: string;
          weight_snapshot: number;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          assessment_result_id: string;
          created_at?: string;
          created_by?: string;
          criterion_id: string;
          criterion_label_snapshot: string;
          deleted_at?: string | null;
          id?: string;
          levels_snapshot: NonNullable<Json>;
          max_score_snapshot: number;
          score: number;
          updated_at?: string;
          version?: number;
          visibility?: string;
          weight_snapshot: number;
          workspace_id: string;
        };
        Update: {
          assessment_result_id?: string;
          created_at?: string;
          created_by?: string;
          criterion_id?: string;
          criterion_label_snapshot?: string;
          deleted_at?: string | null;
          id?: string;
          levels_snapshot?: NonNullable<Json>;
          max_score_snapshot?: number;
          score?: number;
          updated_at?: string;
          version?: number;
          visibility?: string;
          weight_snapshot?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rubric_scores_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rubric_scores_workspace_id_assessment_result_id_fkey";
            columns: ["workspace_id", "assessment_result_id"];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "rubric_scores_workspace_id_assessment_result_id_fkey";
            columns: ["workspace_id", "assessment_result_id"];
            isOneToOne: false;
            referencedRelation: "v_assessment_history";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "rubric_scores_workspace_id_criterion_id_fkey";
            columns: ["workspace_id", "criterion_id"];
            isOneToOne: false;
            referencedRelation: "rubric_criteria";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "rubric_scores_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      school_years: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          ends_on: string;
          id: string;
          label: string;
          starts_on: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_on: string;
          id?: string;
          label: string;
          starts_on: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          ends_on?: string;
          id?: string;
          label?: string;
          starts_on?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_years_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "school_years_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          name: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schools_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schools_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          archived_at: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          external_code: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          external_code: string;
          first_name: string;
          id?: string;
          last_name: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          external_code?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      subjects: {
        Row: {
          code: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          name: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subjects_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subjects_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      teaching_assignments: {
        Row: {
          class_id: string;
          class_subject_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          teacher_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          class_id: string;
          class_subject_id: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          teacher_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          class_id?: string;
          class_subject_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          teacher_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teaching_assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teaching_assignments_workspace_id_class_id_fkey";
            columns: ["workspace_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "teaching_assignments_workspace_id_class_subject_id_class_i_fkey";
            columns: ["workspace_id", "class_subject_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "class_subjects";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "teaching_assignments_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teaching_assignments_workspace_id_teacher_id_fkey";
            columns: ["workspace_id", "teacher_id"];
            isOneToOne: false;
            referencedRelation: "workspace_members";
            referencedColumns: ["workspace_id", "user_id"];
          },
        ];
      };
      topics: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          name: string;
          subject_id: string;
          updated_at: string;
          version: number;
          visibility: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          subject_id: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          subject_id?: string;
          updated_at?: string;
          version?: number;
          visibility?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "topics_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topics_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "topics_workspace_id_subject_id_fkey";
            columns: ["workspace_id", "subject_id"];
            isOneToOne: false;
            referencedRelation: "subjects";
            referencedColumns: ["workspace_id", "id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          revoked_at: string | null;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          revoked_at?: string | null;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          revoked_at?: string | null;
          role?: string;
          user_id?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          owner_id: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_assessment_history: {
        Row: {
          assessed_on: string | null;
          assessment_id: string | null;
          class_id: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          enrollment_id: string | null;
          id: string | null;
          kind: string | null;
          notes: string | null;
          student_id: string | null;
          teaching_assignment_id: string | null;
          title: string | null;
          updated_at: string | null;
          version: number | null;
          visibility: string | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "assessment_results_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_results_workspace_id_assessment_id_class_id_fkey";
            columns: ["workspace_id", "assessment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "assessment_results_workspace_id_assessment_id_teaching_ass_fkey";
            columns: [
              "workspace_id",
              "assessment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["workspace_id", "id", "teaching_assignment_id"];
          },
          {
            foreignKeyName: "assessment_results_workspace_id_enrollment_id_class_id_fkey";
            columns: ["workspace_id", "enrollment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "assessment_results_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      v_class_dashboard: {
        Row: {
          class_id: string | null;
          grade_count: number | null;
          school_year_id: string | null;
          students_with_grades: number | null;
          subject_id: string | null;
          weighted_average: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "grade_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      v_competency_progress: {
        Row: {
          average_ratio: number | null;
          competency_id: string | null;
          enrollment_id: string | null;
          evidence_count: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "assessment_results_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      v_grade_progression: {
        Row: {
          daily_average: number | null;
          grade_count: number | null;
          graded_on: string | null;
          school_year_id: string | null;
          student_id: string | null;
          subject_id: string | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "grade_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      v_grade_register: {
        Row: {
          allow_behavior_in_average: boolean | null;
          assessment_result_id: string | null;
          calculation_snapshot: Json | null;
          category_id: string | null;
          change_reason: string | null;
          class_id: string | null;
          confirmed_value: number | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          enrollment_id: string | null;
          excluded_from_average: boolean | null;
          graded_on: string | null;
          homework_check_id: string | null;
          id: string | null;
          included_in_average: boolean | null;
          observation_id: string | null;
          origin: string | null;
          rule_id: string | null;
          school_id: string | null;
          school_year_id: string | null;
          status: string | null;
          student_id: string | null;
          subject_id: string | null;
          suggested_value: number | null;
          teaching_assignment_id: string | null;
          updated_at: string | null;
          version: number | null;
          visibility: string | null;
          weight: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "grade_entries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_assessment_result_id_enrollment_fkey";
            columns: [
              "workspace_id",
              "assessment_result_id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "assessment_results";
            referencedColumns: [
              "workspace_id",
              "id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_assessment_result_id_enrollment_fkey";
            columns: [
              "workspace_id",
              "assessment_result_id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "v_assessment_history";
            referencedColumns: [
              "workspace_id",
              "id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_category_id_fkey";
            columns: ["workspace_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_categories";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_enrollment_id_class_id_fkey";
            columns: ["workspace_id", "enrollment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_homework_check_id_fkey";
            columns: ["workspace_id", "homework_check_id"];
            isOneToOne: false;
            referencedRelation: "homework_checks";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_homework_check_id_fkey";
            columns: ["workspace_id", "homework_check_id"];
            isOneToOne: false;
            referencedRelation: "v_homework_completion";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_homework_check_id_fkey";
            columns: ["workspace_id", "homework_check_id"];
            isOneToOne: false;
            referencedRelation: "v_homework_summary";
            referencedColumns: ["workspace_id", "homework_check_id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_observation_id_enrollment_id_te_fkey";
            columns: [
              "workspace_id",
              "observation_id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "observations";
            referencedColumns: [
              "workspace_id",
              "id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_observation_id_enrollment_id_te_fkey";
            columns: [
              "workspace_id",
              "observation_id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
            isOneToOne: false;
            referencedRelation: "v_observation_history";
            referencedColumns: [
              "workspace_id",
              "id",
              "enrollment_id",
              "teaching_assignment_id",
            ];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_rule_id_fkey";
            columns: ["workspace_id", "rule_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_rules";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_teaching_assignment_id_class_id_fkey";
            columns: ["workspace_id", "teaching_assignment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "teaching_assignments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
        ];
      };
      v_homework_completion: {
        Row: {
          assignment_id: string | null;
          completed_percent: number | null;
          completion_status: string | null;
          enrollment_id: string | null;
          excuse_reason: string | null;
          excused: boolean | null;
          id: string | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "homework_checks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      v_homework_summary: {
        Row: {
          assignment_id: string | null;
          completed_percent: number | null;
          correct: number | null;
          enrollment_id: string | null;
          homework_check_id: string | null;
          not_done: number | null;
          partial: number | null;
          total_exercises: number | null;
          workspace_id: string | null;
          wrong: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "homework_checks_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      v_observation_history: {
        Row: {
          class_id: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          difficulties: string | null;
          enrollment_id: string | null;
          id: string | null;
          mode: string | null;
          notes: string | null;
          observable_behaviors: string | null;
          observation_type_id: string | null;
          observed_on: string | null;
          participation: string | null;
          strengths: string | null;
          student_id: string | null;
          teaching_assignment_id: string | null;
          updated_at: string | null;
          version: number | null;
          visibility: string | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "observations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observations_workspace_id_enrollment_id_class_id_fkey";
            columns: ["workspace_id", "enrollment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "enrollments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
          {
            foreignKeyName: "observations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "observations_workspace_id_observation_type_id_fkey";
            columns: ["workspace_id", "observation_type_id"];
            isOneToOne: false;
            referencedRelation: "observation_types";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "observations_workspace_id_teaching_assignment_id_class_id_fkey";
            columns: ["workspace_id", "teaching_assignment_id", "class_id"];
            isOneToOne: false;
            referencedRelation: "teaching_assignments";
            referencedColumns: ["workspace_id", "id", "class_id"];
          },
        ];
      };
      v_recurring_errors: {
        Row: {
          enrollment_id: string | null;
          error_type_id: string | null;
          occurrences: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
      v_student_averages: {
        Row: {
          category_id: string | null;
          grade_count: number | null;
          school_year_id: string | null;
          student_id: string | null;
          subject_id: string | null;
          weighted_average: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "grade_entries_workspace_id_category_id_fkey";
            columns: ["workspace_id", "category_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_categories";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "grade_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      v_subject_dashboard: {
        Row: {
          grade_count: number | null;
          school_year_id: string | null;
          subject_id: string | null;
          weighted_average: number | null;
          workspace_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "grade_entries_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      apply_import: {
        Args: { p_batch: string; p_expected_version: number };
        Returns: number;
      };
      frontend_apply_import: {
        Args: { p_batch: string; p_expected_version: number };
        Returns: number;
      };
      frontend_sync_mutation: {
        Args: {
          p_expected_version: number;
          p_id: string;
          p_operation: string;
          p_patch: Json;
          p_table: string;
          p_workspace: string;
        };
        Returns: Json;
      };
      preview_import: {
        Args: { p_kind: string; p_rows: Json; p_workspace: string };
        Returns: string;
      };
      propose_grade: {
        Args: {
          p_max: number;
          p_min: number;
          p_points: Json;
          p_ratio: number;
          p_step: number;
        };
        Returns: number;
      };
      remove_workspace_member: {
        Args: { p_user: string; p_workspace: string };
        Returns: undefined;
      };
      set_workspace_member: {
        Args: { p_role: string; p_user: string; p_workspace: string };
        Returns: undefined;
      };
      student_average: {
        Args: {
          p_category?: string;
          p_end: string;
          p_start: string;
          p_student: string;
          p_subject: string;
          p_workspace: string;
          p_year?: string;
        };
        Returns: number;
      };
      sync_mutation: {
        Args: {
          p_expected_version: number;
          p_id: string;
          p_operation: string;
          p_patch: Json;
          p_table: string;
          p_workspace: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
